from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from postgrest.exceptions import APIError

from app.core.supabase_client import get_service_supabase
from app.services.betting_odds import (
    next_goal_probs, payout, remaining_fraction, result_probs, settle_result, team_rates, to_odds, total_goals_probs,
)
from app.services.match_clock import elapsed_seconds, regular_time_seconds

OVER_STATES = {"FULL_TIME", "COMPLETED"}
CANCELLED_STATES = {"ABANDONED", "CANCELLED"}
CLOSED_STATES = OVER_STATES | CANCELLED_STATES | {"POSTPONED"}
LIVE_STATES = {"LIVE", "SECOND_HALF", "HALF_TIME", "PAUSED", "EXTRA_TIME_1", "EXTRA_TIME_BREAK", "EXTRA_TIME_2", "PENALTY_SHOOTOUT"}
MAX_STAKE = 500
SUSPEND_AFTER_SHOT_SECONDS = 8  # recorders log with a small delay, so a shot just taken may already have been a goal


def _sb():
    return get_service_supabase()


def _bad(status: int, code: str, message: str, **extra):
    return HTTPException(status_code=status, detail={"code": code, "message": message, **extra})


class BettingService:
    # ---------- wallet ----------

    def wallet(self, user_id: str) -> dict:
        w = _sb().rpc("bet_ensure_wallet", {"p_user": user_id}).execute().data
        w = w[0] if isinstance(w, list) else w
        pending = _sb().table("bets").select("id").eq("user_id", user_id).eq("status", "PENDING").limit(1).execute().data
        last = w.get("last_refill_at")
        recent = last and datetime.fromisoformat(last.replace("Z", "+00:00")) > datetime.now(timezone.utc) - timedelta(hours=24)
        return {"balance": w["balance"], "can_refill": w["balance"] < 100 and not pending and not recent}

    def refill(self, user_id: str) -> dict:
        try:
            _sb().rpc("bet_refill", {"p_user": user_id}).execute()
        except APIError as e:
            if "REFILL_NOT_AVAILABLE" in str(e):
                raise _bad(400, "REFILL_NOT_AVAILABLE", "A refill needs under 100 coins, nothing pending, and 24 hours since the last one.")
            raise
        return self.wallet(user_id)

    # ---------- reading the board ----------

    def _context(self, match_id: str) -> dict:
        sb = _sb()
        m = sb.table("matches").select("*").eq("id", match_id).execute().data
        if not m:
            raise _bad(404, "NOT_FOUND", "Match not found")
        m = m[0]
        ev = sb.table("events").select("id, name, status, slug").eq("id", m["event_id"]).execute().data[0]
        if ev["status"] == "DRAFT":
            raise _bad(404, "NOT_FOUND", "Match not found")
        settings = (sb.table("event_settings").select("*").eq("event_id", ev["id"]).execute().data or [{}])[0]
        names = {r["id"]: r["team_name"] for r in sb.table("event_team_registrations").select("id, team_name")
                 .in_("id", [x for x in (m["home_registration_id"], m["away_registration_id"]) if x]).execute().data}
        return {"match": m, "event": ev, "settings": settings, "home": names.get(m["home_registration_id"]), "away": names.get(m["away_registration_id"])}

    def _rates(self, ctx: dict) -> tuple[float, float, float]:
        m = ctx["match"]
        done = _sb().table("matches").select("home_registration_id, away_registration_id, home_score, away_score") \
            .eq("event_id", m["event_id"]).eq("match_state", "COMPLETED").neq("id", m["id"]).execute().data
        tally: dict = {}
        for r in done:
            for t, gf, ga in ((r["home_registration_id"], r["home_score"], r["away_score"]), (r["away_registration_id"], r["away_score"], r["home_score"])):
                x = tally.setdefault(t, {"played": 0, "gf": 0, "ga": 0})
                x["played"] += 1; x["gf"] += gf; x["ga"] += ga
        avg = sum(r["home_score"] + r["away_score"] for r in done) / (2 * len(done)) if done else None
        lh, la = team_rates(tally.get(m["home_registration_id"], {}), tally.get(m["away_registration_id"], {}), avg)
        return lh, la, (avg or 2.0)

    def _suspension(self, ctx: dict) -> Optional[dict]:
        m = ctx["match"]
        if m["match_state"] in CLOSED_STATES:
            return {"reason": "Match is over", "permanent": True}
        if not (m["home_registration_id"] and m["away_registration_id"]):
            return {"reason": "Teams not decided yet", "permanent": False}
        if (m.get("metadata") or {}).get("betting_paused"):
            return {"reason": "Paused by the match officials", "permanent": False}
        if m["match_state"] == "PAUSED":
            return {"reason": "Play is stopped", "permanent": False}
        last = _sb().table("match_timeline_events").select("created_at").eq("match_id", m["id"]).eq("event_type", "SHOT") \
            .order("created_at", desc=True).limit(1).execute().data
        if last:
            at = datetime.fromisoformat(last[0]["created_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - at < timedelta(seconds=SUSPEND_AFTER_SHOT_SECONDS):
                return {"reason": "Shot just taken, checking the result", "permanent": False, "until": (at + timedelta(seconds=SUSPEND_AFTER_SHOT_SECONDS)).isoformat()}
        return None

    def _goals(self, ctx: dict) -> list[str]:
        m = ctx["match"]
        rows = _sb().table("match_timeline_events").select("actor_registration_id, elapsed_seconds, created_at") \
            .eq("match_id", m["id"]).eq("event_type", "SHOT").eq("metadata->>result", "GOAL").order("elapsed_seconds").order("created_at").execute().data
        return ["HOME" if r["actor_registration_id"] == m["home_registration_id"] else "AWAY" for r in rows]

    def ensure_markets(self, ctx: dict, goals: int, lam_total: float) -> list[dict]:
        sb, m = _sb(), ctx["match"]
        existing = sb.table("bet_markets").select("*").eq("match_id", m["id"]).execute().data
        kinds = {x["kind"] for x in existing}
        goal_nos = {x["params"].get("goal_no") for x in existing if x["kind"] == "NEXT_GOAL"}
        base = {"event_id": m["event_id"], "match_id": m["id"]}
        rows = []
        if "MATCH_RESULT" not in kinds:
            rows.append({**base, "kind": "MATCH_RESULT", "params": {}})
        if goals + 1 not in goal_nos:
            rows.append({**base, "kind": "NEXT_GOAL", "params": {"goal_no": goals + 1}})
        if "TOTAL_GOALS" not in kinds:  # one line near the expected total, fixed for the whole match
            rows.append({**base, "kind": "TOTAL_GOALS", "params": {"line": float(max(0, int(lam_total))) + 0.5}})
        if rows and m["match_state"] not in CLOSED_STATES:
            for row in rows:
                try:
                    sb.table("bet_markets").insert(row).execute()
                except APIError:  # a concurrent request created the same market first (unique index): fine
                    pass
            existing = sb.table("bet_markets").select("*").eq("match_id", m["id"]).execute().data
        return existing

    def _options(self, kind: str, params: dict, ctx: dict, probs: dict) -> list[dict]:
        home, away = ctx["home"] or "Home", ctx["away"] or "Away"
        label = {"HOME": home, "AWAY": away, "DRAW": "Draw", "NONE": "No more goals"}
        if kind == "TOTAL_GOALS":
            label = {"OVER": f"Over {params['line']}", "UNDER": f"Under {params['line']}"}
        order = {"MATCH_RESULT": ["HOME", "DRAW", "AWAY"], "NEXT_GOAL": ["HOME", "NONE", "AWAY"], "TOTAL_GOALS": ["OVER", "UNDER"]}[kind]
        return [{"key": k, "label": label[k], "odds": to_odds(probs[k])} for k in order]

    def board(self, match_id: str, user_id: Optional[str]) -> dict:
        ctx = self._context(match_id)
        m, settings = ctx["match"], ctx["settings"]
        lam_h, lam_a, _ = self._rates(ctx)
        goal_list = self._goals(ctx)
        gh, ga = goal_list.count("HOME"), goal_list.count("AWAY")
        elapsed = elapsed_seconds(m, settings)
        total_s = regular_time_seconds(settings, m)
        frac = remaining_fraction(elapsed, total_s) if m["match_state"] in LIVE_STATES else 1.0
        h_rem, a_rem = lam_h * frac, lam_a * frac
        markets = self.ensure_markets(ctx, len(goal_list), lam_h + lam_a)
        suspension = self._suspension(ctx)

        my_bets = []
        if user_id:
            my_bets = _sb().table("bets").select("id, market_id, selection, stake, odds, status, payout, created_at").eq("user_id", user_id)                 .eq("match_id", match_id).order("created_at", desc=True).execute().data
        bet_on = {b["market_id"] for b in my_bets}

        out = []
        for mk in sorted(markets, key=lambda x: ({"MATCH_RESULT": 0, "NEXT_GOAL": 1, "TOTAL_GOALS": 2}.get(x["kind"], 9), x["params"].get("goal_no") or 0)):
            if mk["kind"] not in ("MATCH_RESULT", "NEXT_GOAL", "TOTAL_GOALS"):
                continue
            if mk["kind"] == "NEXT_GOAL" and mk["status"] != "OPEN" and mk["id"] not in bet_on:
                continue  # old goal markets only matter to the people who bet on them
            if mk["kind"] == "MATCH_RESULT":
                probs = result_probs(gh, ga, h_rem, a_rem)
            elif mk["kind"] == "NEXT_GOAL":
                probs = next_goal_probs(h_rem, a_rem)
            else:
                probs = total_goals_probs(gh, ga, h_rem, a_rem, float(mk["params"]["line"]))
            out.append({"id": mk["id"], "kind": mk["kind"], "params": mk["params"], "status": mk["status"], "result": mk["result"],
                        "options": self._options(mk["kind"], mk["params"], ctx, probs)})

        return {
            "match": {"id": m["id"], "event_id": ctx["event"]["id"], "event_name": ctx["event"]["name"], "event_slug": ctx["event"].get("slug"),
                      "home": ctx["home"], "away": ctx["away"], "home_score": m["home_score"], "away_score": m["away_score"],
                      "state": m["match_state"], "minute": elapsed // 60 if m["match_state"] in LIVE_STATES else None},
            "markets": out,
            "suspended": suspension,
            "eligible": self._eligibility(ctx, user_id) if user_id else {"ok": False, "reason": "Sign in to predict"},
            "my_bets": my_bets,
            "max_stake": MAX_STAKE,
        }

    def _eligibility(self, ctx: dict, user_id: str) -> dict:
        """People who run or play in a match must not bet on it."""
        sb, m = _sb(), ctx["match"]
        if sb.table("event_roles").select("id").eq("event_id", m["event_id"]).eq("user_id", user_id).limit(1).execute().data:
            return {"ok": False, "reason": "You help run this event, so you cannot predict its matches"}
        regs = [x for x in (m["home_registration_id"], m["away_registration_id"]) if x]
        if regs and (sb.table("event_team_players").select("id").in_("event_registration_id", regs).eq("user_id", user_id).limit(1).execute().data
                     or sb.table("event_team_registrations").select("id").in_("id", regs).eq("captain_id", user_id).limit(1).execute().data):
            return {"ok": False, "reason": "You play in this match, so you cannot predict it"}
        return {"ok": True}

    # ---------- placing a bet ----------

    def place(self, user_id: str, match_id: str, market_id: str, selection: str, stake: int, shown_odds: float, key) -> dict:
        board = self.board(match_id, user_id)
        if not board["eligible"]["ok"]:
            raise _bad(403, "NOT_ELIGIBLE", board["eligible"]["reason"])
        if board["suspended"]:
            raise _bad(409, "SUSPENDED", board["suspended"]["reason"])
        if not 1 <= stake <= MAX_STAKE:
            raise _bad(400, "BAD_STAKE", f"Stake must be between 1 and {MAX_STAKE} coins")
        market = next((x for x in board["markets"] if x["id"] == market_id), None)
        if not market or market["status"] != "OPEN":
            raise _bad(409, "MARKET_CLOSED", "That market is closed")
        option = next((o for o in market["options"] if o["key"] == selection), None)
        if not option:
            raise _bad(400, "BAD_SELECTION", "Unknown selection")
        if option["odds"] is None:
            raise _bad(409, "NO_ODDS", "This outcome is too certain to offer")
        if option["odds"] < shown_odds - 0.02:  # the price got worse while the user was deciding
            raise _bad(409, "ODDS_CHANGED", "The odds changed", odds=option["odds"])
        try:
            bet_id = _sb().rpc("bet_place", {"p_user": user_id, "p_market": market_id, "p_selection": selection, "p_stake": stake,
                                             "p_odds": option["odds"], "p_key": str(key) if key else None}).execute().data
        except APIError as e:
            text = str(e)
            for code, status, msg in (("INSUFFICIENT_COINS", 400, "Not enough coins"), ("MARKET_CLOSED", 409, "That market is closed")):
                if code in text:
                    raise _bad(status, code, msg)
            raise
        return {"bet_id": bet_id, "odds": option["odds"], "potential_payout": payout(stake, option["odds"]), "wallet": self.wallet(user_id)}

    # ---------- settlement (recomputed from the timeline, so undo and corrections repair wallets) ----------

    def settle_match(self, match_id: str) -> dict:
        sb = _sb()
        m = sb.table("matches").select("*").eq("id", match_id).execute().data
        if not m:
            return {"settled": 0}
        m = m[0]
        ctx = {"match": m}
        goals = self._goals(ctx)
        over = m["match_state"] in OVER_STATES
        touched = 0
        markets = sb.table("bet_markets").select("*").eq("match_id", match_id).execute().data
        for mk in markets:
            if mk["kind"] not in ("MATCH_RESULT", "NEXT_GOAL", "TOTAL_GOALS"):
                continue
            if m["match_state"] in CANCELLED_STATES:
                touched += sb.rpc("bet_apply_result", {"p_market": mk["id"], "p_result": None, "p_void": True}).execute().data or 0
                continue
            result = settle_result(mk["kind"], mk["params"], m["home_score"], m["away_score"], goals, over)
            touched += sb.rpc("bet_apply_result", {"p_market": mk["id"], "p_result": result, "p_void": False}).execute().data or 0
        if markets and not over and m["match_state"] not in CANCELLED_STATES:  # the next goal market opens as soon as one closes
            lam_h, lam_a, _ = self._rates({"match": m})
            self.ensure_markets({"match": m}, len(goals), lam_h + lam_a)
        return {"settled": touched}

    # ---------- leaderboard, history, hub ----------

    def leaderboard(self, event_id: Optional[str], limit: int) -> list[dict]:
        return _sb().rpc("bet_leaderboard", {"p_event": event_id, "p_limit": limit}).execute().data

    def my_bets(self, user_id: str, limit: int) -> list[dict]:
        sb = _sb()
        bets = sb.table("bets").select("id, match_id, market_id, selection, stake, odds, status, payout, created_at, settled_at") \
            .eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute().data
        if not bets:
            return []
        matches = {x["id"]: x for x in sb.table("matches").select("id, home_registration_id, away_registration_id, home_score, away_score, match_state, event_id")
                   .in_("id", list({b["match_id"] for b in bets})).execute().data}
        regs = {x["id"]: x["team_name"] for x in sb.table("event_team_registrations").select("id, team_name")
                .in_("id", list({r for x in matches.values() for r in (x["home_registration_id"], x["away_registration_id"]) if r})).execute().data}
        markets = {x["id"]: x for x in sb.table("bet_markets").select("id, kind, params").in_("id", list({b["market_id"] for b in bets})).execute().data}
        for b in bets:
            mt = matches.get(b["match_id"], {})
            mk = markets.get(b["market_id"], {})
            b["match"] = {"home": regs.get(mt.get("home_registration_id")), "away": regs.get(mt.get("away_registration_id")),
                          "home_score": mt.get("home_score"), "away_score": mt.get("away_score"), "state": mt.get("match_state"), "event_id": mt.get("event_id")}
            b["market"] = {"kind": mk.get("kind"), "params": mk.get("params")}
        return bets

    def live_hub(self) -> list[dict]:
        """Matches people can predict right now: live ones first, then the next few kickoffs."""
        sb = _sb()
        now = datetime.now(timezone.utc)
        rows = sb.table("matches").select("id, event_id, home_registration_id, away_registration_id, home_score, away_score, match_state, scheduled_start") \
            .eq("scheduling_status", "ASSIGNED").not_.in_("match_state", list(CLOSED_STATES)) \
            .not_.is_("home_registration_id", "null").not_.is_("away_registration_id", "null") \
            .order("scheduled_start").limit(60).execute().data
        events = {e["id"]: e for e in sb.table("events").select("id, name, slug, status").in_("id", list({r["event_id"] for r in rows}) or ["00000000-0000-0000-0000-000000000000"]).execute().data}
        regs = {x["id"]: x["team_name"] for x in sb.table("event_team_registrations").select("id, team_name")
                .in_("id", list({r for x in rows for r in (x["home_registration_id"], x["away_registration_id"])}) or ["00000000-0000-0000-0000-000000000000"]).execute().data}
        out = []
        for r in rows:
            ev = events.get(r["event_id"])
            if not ev or ev["status"] == "DRAFT":
                continue
            start = r["scheduled_start"] and datetime.fromisoformat(r["scheduled_start"].replace("Z", "+00:00"))
            live = r["match_state"] in LIVE_STATES
            if not live and start and start > now + timedelta(hours=36):
                continue
            out.append({"match_id": r["id"], "event_id": ev["id"], "event_name": ev["name"], "event_slug": ev.get("slug"), "home": regs.get(r["home_registration_id"]),
                        "away": regs.get(r["away_registration_id"]), "home_score": r["home_score"], "away_score": r["away_score"], "state": r["match_state"],
                        "scheduled_start": r["scheduled_start"], "live": live})
        out.sort(key=lambda x: (not x["live"], x["scheduled_start"] or ""))
        return out[:30]

    def set_paused(self, match_id: str, paused: bool) -> dict:
        sb = _sb()
        m = sb.table("matches").select("metadata").eq("id", match_id).execute().data
        if not m:
            raise _bad(404, "NOT_FOUND", "Match not found")
        sb.table("matches").update({"metadata": {**(m[0]["metadata"] or {}), "betting_paused": paused}}).eq("id", match_id).execute()
        return {"paused": paused}


betting_service = BettingService()
