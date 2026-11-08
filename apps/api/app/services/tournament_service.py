import random
from datetime import datetime, timedelta, timezone
from itertools import zip_longest
from uuid import UUID

from fastapi import HTTPException

from app.core.supabase_client import get_service_supabase
from app.services.event_service import EventService
from app.services.idempotency_service import IdempotencyService
from app.services.tournament_format import (
    build_knockout, knockout_entrants, match_winner, rank_teams, resolve_source, round_robin, split_groups,
)

SUPPORTED_FORMATS = {"ROUND_ROBIN", "DOUBLE_ROUND_ROBIN", "KNOCKOUT", "GROUP_KNOCKOUT"}
MATCH_COLS = ("id, metadata, group_id, bracket_id, home_registration_id, away_registration_id, home_score, "
              "away_score, match_state, winner_registration_id, scheduling_status")


def _group_label(i: int) -> str:
    return f"Group {chr(ord('A') + i)}" if i < 26 else f"Group {i + 1}"


def _fixture(event_id, home, away, created_at, **extra) -> dict:
    return {"event_id": str(event_id), "home_registration_id": home, "away_registration_id": away,
            "status": "SCHEDULED", "scheduling_status": "UNASSIGNED",
            "created_at": created_at.isoformat(), **extra}


class TournamentService:

    # ---------- generation ----------

    def generate(self, event_id: UUID, payload, actor_id: UUID) -> dict:
        EventService._require_admin(str(event_id), str(actor_id))
        cached = IdempotencyService.check_idempotency(payload.idempotency_key, event_id, "GENERATE_FIXTURES")
        if cached:
            return cached

        sb = get_service_supabase()
        if not sb.table("events").select("id").eq("id", str(event_id)).execute().data:
            raise HTTPException(404, "Event not found")
        if sb.table("matches").select("id").eq("event_id", str(event_id)).limit(1).execute().data:
            raise HTTPException(400, "Fixtures already exist for this event. Reset them first to change the format.")

        settings = sb.table("event_settings").select("tournament_format").eq("event_id", str(event_id)).execute().data
        fmt = payload.tournament_format or (settings[0]["tournament_format"] if settings else "ROUND_ROBIN")
        if fmt not in SUPPORTED_FORMATS:
            raise HTTPException(400, f"Format {fmt} cannot be auto-generated. Use one of {sorted(SUPPORTED_FORMATS)}.")

        regs = sb.table("event_team_registrations").select("id").eq("event_id", str(event_id)) \
            .eq("status", "APPROVED").order("seed", nullsfirst=False).order("registered_at").execute().data
        ids = [r["id"] for r in regs]
        if payload.draw == "RANDOM":
            random.shuffle(ids)  # unseeded on purpose: every draw is different
        n = len(ids)
        if n < 2:
            raise HTTPException(400, "At least 2 approved teams are required to generate fixtures")

        base = datetime.now(timezone.utc)
        tick = iter(range(10_000))  # created_at drives the scheduler's order, so keep it strictly increasing
        stamp = lambda: base + timedelta(milliseconds=next(tick))

        group_count = 1
        if fmt == "GROUP_KNOCKOUT":
            group_count, advance = payload.group_count, payload.advance_per_group
            if group_count < 2 or n < group_count * 2:
                raise HTTPException(400, f"{n} teams cannot fill {group_count} groups of at least 2 teams")
            if advance < 1 or advance > n // group_count or group_count * advance < 2:
                raise HTTPException(400, f"{advance} qualifier(s) per group is not possible with {n} teams in {group_count} groups")

        if payload.tournament_format:
            sb.table("event_settings").update({"tournament_format": fmt}).eq("event_id", str(event_id)).execute()

        fixtures: list[dict] = []
        group_ids: list[str] = []
        if fmt in ("ROUND_ROBIN", "DOUBLE_ROUND_ROBIN"):
            fixtures = [_fixture(event_id, h, a, stamp()) for h, a in round_robin(ids, fmt == "DOUBLE_ROUND_ROBIN")]
        elif fmt == "GROUP_KNOCKOUT":
            groups = split_groups(ids, group_count)
            rows = sb.table("groups").insert(
                [{"event_id": str(event_id), "name": _group_label(i)} for i in range(group_count)]).execute().data
            group_ids = [r["id"] for r in rows]
            per_group = []
            for gid, members in zip(group_ids, groups):
                sb.table("event_team_registrations").update({"group_id": gid}).in_("id", members).execute()
                per_group.append([(gid, h, a) for h, a in round_robin(members, payload.double_round_robin_groups)])
            # interleave groups so one group's games are not all scheduled before another's starts
            for batch in zip_longest(*per_group):
                fixtures += [_fixture(event_id, h, a, stamp(), group_id=g) for g, h, a in filter(None, batch)]

        if fixtures:
            sb.table("matches").insert(fixtures).execute()

        knockout_count = 0
        if fmt in ("KNOCKOUT", "GROUP_KNOCKOUT"):
            entrants = (knockout_entrants(group_ids, payload.advance_per_group) if fmt == "GROUP_KNOCKOUT"
                        else [{"type": "team", "registration_id": i} for i in ids])
            knockout_count = self._insert_bracket(sb, event_id, build_knockout(entrants, payload.third_place), stamp)
            self.advance_bracket(event_id)  # fills round 1 for plain KNOCKOUT

        result = {"success": True, "fixture_count": len(fixtures) + knockout_count,
                  "message": f"Created {len(fixtures)} league/group fixtures and {knockout_count} knockout fixtures ({fmt}, {payload.draw.lower()} draw)"}
        EventService._log_audit(str(actor_id), "GENERATE_FIXTURES", "events", str(event_id), None,
                                {"format": fmt, "groups": group_count, "teams": n, "draw": payload.draw, **result})
        IdempotencyService.save_idempotency(payload.idempotency_key, actor_id, event_id, "GENERATE_FIXTURES", result)
        return result

    @staticmethod
    def _insert_bracket(sb, event_id, specs: list[dict], stamp) -> int:
        match_of: dict[str, str] = {}

        def source(s: dict) -> dict:
            if s["type"] in ("winner_of", "loser_of"):
                return {"type": s["type"], "match_id": match_of[s["key"]]}
            return s

        for spec in specs:
            b = sb.table("brackets").insert({
                "event_id": str(event_id), "round_name": spec["round_name"], "position": spec["position"],
                "home_source": source(spec["home"]), "away_source": source(spec["away"])}).execute().data[0]
            m = sb.table("matches").insert(_fixture(event_id, None, None, stamp(), bracket_id=b["id"])).execute().data[0]
            sb.table("brackets").update({"match_id": m["id"]}).eq("id", b["id"]).execute()
            match_of[spec["key"]] = m["id"]
        return len(specs)

    def reset(self, event_id: UUID, actor_id: UUID) -> dict:
        EventService._require_admin(str(event_id), str(actor_id))
        sb = get_service_supabase()
        rows = sb.table("matches").select("id, match_state").eq("event_id", str(event_id)).execute().data
        if any(r["match_state"] != "SCHEDULED" for r in rows):
            raise HTTPException(400, "Cannot reset: at least one match has already started")
        eid = str(event_id)
        # Order matters: brackets and groups reference matches/registrations with SET NULL, slots keep their rows.
        sb.table("matches").delete().eq("event_id", eid).execute()
        sb.table("brackets").delete().eq("event_id", eid).execute()
        sb.table("groups").delete().eq("event_id", eid).execute()
        sb.table("event_team_registrations").update({"group_id": None}).eq("event_id", eid).execute()
        sb.table("schedule_slots").update({"status": "EMPTY"}).eq("event_id", eid).execute()
        EventService._log_audit(str(actor_id), "RESET_FIXTURES", "events", eid, {"matches": len(rows)}, None)
        return {"success": True, "deleted_matches": len(rows)}

    # ---------- progression ----------

    def _load(self, sb, event_id) -> dict:
        eid = str(event_id)
        matches = sb.table("matches").select(MATCH_COLS).eq("event_id", eid).execute().data
        regs = sb.table("event_team_registrations").select("id, team_name, group_id").eq("event_id", eid) \
            .eq("status", "APPROVED").execute().data
        groups = sb.table("groups").select("id, name").eq("event_id", eid).order("name").execute().data
        s = sb.table("event_settings").select("points_win, points_draw, points_loss").eq("event_id", eid).execute().data
        pts = (s[0]["points_win"], s[0]["points_draw"], s[0]["points_loss"]) if s else (3, 1, 0)
        group_tables: dict = {}
        for g in groups:
            members = [r["id"] for r in regs if r["group_id"] == g["id"]]
            fixtures = [m for m in matches if m["group_id"] == g["id"] and not m["bracket_id"]]
            done = [m for m in fixtures if m["match_state"] == "COMPLETED"]
            group_tables[g["id"]] = {
                "table": rank_teams(members, done, *pts),
                "complete": bool(fixtures) and len(done) == len(fixtures),
            }
        return {"matches": matches, "regs": regs, "groups": groups, "group_tables": group_tables}

    def advance_bracket(self, event_id: UUID) -> int:
        """Fill every bracket slot whose source is now decided. Only empty slots are touched."""
        sb = get_service_supabase()
        brackets = sb.table("brackets").select("*").eq("event_id", str(event_id)).execute().data
        if not brackets:
            return 0
        d = self._load(sb, event_id)
        by_id = {m["id"]: m for m in d["matches"]}
        ctx = {"matches": by_id,
               "group_tables": {gid: (t["table"] if t["complete"] else None) for gid, t in d["group_tables"].items()}}
        filled = 0
        for b in brackets:
            m = by_id.get(b["match_id"])
            if not m or m["match_state"] != "SCHEDULED":
                continue
            for src, col in (("home_source", "home_registration_id"), ("away_source", "away_registration_id")):
                if m[col] is None:
                    rid = resolve_source(b[src], ctx)
                    if rid:
                        sb.table("matches").update({col: rid}).eq("id", m["id"]).execute()
                        m[col] = rid
                        filled += 1
        return filled

    def set_winner(self, event_id: UUID, match_id: UUID, winner_id: UUID, actor_id: UUID,
                   shootout_home: int | None = None, shootout_away: int | None = None) -> dict:
        """Manual decision (e.g. penalty shoot-out) for a drawn knockout match."""
        sb = get_service_supabase()
        roles = sb.table("event_roles").select("role").eq("event_id", str(event_id)).eq("user_id", str(actor_id)) \
            .in_("role", ["EVENT_OWNER", "EVENT_ADMIN", "EVENT_MANAGER", "REFEREE"]).execute().data
        if not roles:
            raise HTTPException(403, "Not authorized. Must be an event admin, manager or referee.")
        res = sb.table("matches").select(MATCH_COLS + ", event_id").eq("id", str(match_id)).execute().data
        if not res or res[0]["event_id"] != str(event_id):
            raise HTTPException(404, "Match not found in this event")
        m = res[0]
        if not m["bracket_id"]:
            raise HTTPException(400, "Only knockout matches need a decided winner")
        if m["match_state"] != "COMPLETED":
            raise HTTPException(400, "Match must be completed first")
        if m["home_score"] != m["away_score"]:
            raise HTTPException(400, "Match was not drawn; the winner is the higher score")
        if str(winner_id) not in (m["home_registration_id"], m["away_registration_id"]):
            raise HTTPException(400, "Winner must be one of the two teams in this match")
        update: dict = {"winner_registration_id": str(winner_id), "result_type": "PENALTIES"}
        if shootout_home is not None or shootout_away is not None:
            if shootout_home is None or shootout_away is None or shootout_home == shootout_away:
                raise HTTPException(400, "A shoot-out needs both scores and cannot end level")
            if (str(winner_id) == m["home_registration_id"]) != (shootout_home > shootout_away):
                raise HTTPException(400, "The winner does not match the shoot-out score")
            update["metadata"] = {**(m.get("metadata") or {}), "shootout": {"home": shootout_home, "away": shootout_away}}
        sb.table("matches").update(update).eq("id", str(match_id)).execute()
        EventService._log_audit(str(actor_id), "SET_KNOCKOUT_WINNER", "matches", str(match_id),
                                {"winner_registration_id": m["winner_registration_id"]},
                                {"winner_registration_id": str(winner_id)})
        return {"success": True, "advanced": self.advance_bracket(event_id)}

    # ---------- public read models ----------

    def group_standings(self, event_id: UUID) -> list[dict]:
        sb = get_service_supabase()
        self._require_public(sb, event_id)
        d = self._load(sb, event_id)
        names = {r["id"]: r["team_name"] for r in d["regs"]}
        return [{"group_id": g["id"], "name": g["name"], "complete": d["group_tables"][g["id"]]["complete"],
                 "rows": [{**r, "team_name": names.get(r["team_id"], "Unknown")} for r in d["group_tables"][g["id"]]["table"]]}
                for g in d["groups"]]

    def bracket(self, event_id: UUID) -> list[dict]:
        sb = get_service_supabase()
        self._require_public(sb, event_id)
        d = self._load(sb, event_id)
        names = {r["id"]: r["team_name"] for r in d["regs"]}
        gname = {g["id"]: g["name"] for g in d["groups"]}
        by_id = {m["id"]: m for m in d["matches"]}
        brackets = sb.table("brackets").select("*").eq("event_id", str(event_id)).execute().data
        round_of = {b["match_id"]: b["round_name"] + str(b["position"]) for b in brackets}

        def label(src: dict) -> str:
            t = src.get("type")
            if t == "group_position":
                return f"{gname.get(src['group_id'], 'Group')} #{src['position']}"
            if t in ("winner_of", "loser_of"):
                ref = round_of.get(src.get("match_id"), "?")
                return f"{'Winner' if t == 'winner_of' else 'Loser'} of {ref}"
            return "TBD"

        out = []
        for b in brackets:
            m = by_id.get(b["match_id"], {})
            played = m.get("match_state") == "COMPLETED"
            out.append({
                "id": b["id"], "match_id": b["match_id"], "round_name": b["round_name"], "position": b["position"],
                "home": {"team_id": m.get("home_registration_id"), "name": names.get(m.get("home_registration_id")),
                         "placeholder": label(b["home_source"])},
                "away": {"team_id": m.get("away_registration_id"), "name": names.get(m.get("away_registration_id")),
                         "placeholder": label(b["away_source"])},
                "home_score": m.get("home_score") if played else None,
                "away_score": m.get("away_score") if played else None,
                "state": m.get("match_state"),
                "winner_id": match_winner(m) if played else None,
                "shootout": (m.get("metadata") or {}).get("shootout") if played else None,
            })
        return out

    @staticmethod
    def _require_public(sb, event_id):
        ev = sb.table("events").select("status").eq("id", str(event_id)).execute().data
        if not ev or ev[0]["status"] == "DRAFT":
            raise HTTPException(404, "Event not found")


tournament_service = TournamentService()
