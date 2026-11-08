"""The virtual-coin predictions game end to end: wallets, odds, bets, live settlement, undo repair, leaderboard."""
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from supabase import create_client

from app.core.supabase_client import supabase_admin as db
from app.services import betting_service as betting_module


@pytest.fixture(autouse=True)
def no_shot_suspension(monkeypatch):
    # the real rule freezes betting for a few seconds after every shot; tests that need it switch it back on
    monkeypatch.setattr(betting_module, "SUSPEND_AFTER_SHOT_SECONDS", 0)


def make_bettor(tag="bettor"):
    email, password = f"{tag}_{uuid4().hex[:8]}@example.com", "TestPassword123!"
    user = db.auth.admin.create_user({"email": email, "password": password, "email_confirm": True}).user
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"])
    token = sb.auth.sign_in_with_password({"email": email, "password": password}).session.access_token
    return {"id": user.id, "h": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def game(auth_client, users, test_client):
    org = auth_client("ORGANIZER")
    ev = org.post("/api/v1/events", json={"name": f"TEST__BET__{uuid4().hex[:8]}", "description": "bets"}).json()
    eid = ev["id"]
    db.table("events").update({"status": "LIVE"}).eq("id", eid).execute()
    db.table("event_settings").update({"first_half_minutes": 10, "second_half_minutes": 10}).eq("event_id", eid).execute()
    base = datetime.now(timezone.utc)
    teams = []
    for i, captain in enumerate(("CAPTAIN", "SECOND_CAPTAIN")):
        reg = db.table("event_team_registrations").insert({
            "event_id": eid, "team_name": ("Reds", "Blues")[i], "status": "APPROVED", "captain_id": users[captain]["id"],
            "registered_at": (base + timedelta(seconds=i)).isoformat()}).execute().data[0]
        pl = db.table("event_team_players").insert([{"event_registration_id": reg["id"], "guest_name": f"P{i}{j}", "status": "APPROVED"} for j in range(3)]).execute().data
        teams.append({"reg": reg["id"], "players": [p["id"] for p in pl]})
    match = db.table("matches").insert({"event_id": eid, "home_registration_id": teams[0]["reg"], "away_registration_id": teams[1]["reg"],
                                        "scheduling_status": "ASSIGNED", "status": "SCHEDULED"}).execute().data[0]
    bettors = [make_bettor("bet_a"), make_bettor("bet_b")]
    ctx = {"event": eid, "match": match["id"], "teams": teams, "org": org, "client": test_client, "bettors": bettors,
           "base": f"/api/v1/events/{eid}/matches/{match['id']}"}
    yield ctx
    db.table("events").delete().eq("id", eid).execute()
    for b in bettors:
        db.auth.admin.delete_user(b["id"])


def go(game, state):
    if state in ("READY", "LIVE"):  # kick-off needs both lineups confirmed
        have = {r["team_registration_id"] for r in db.table("match_lineups").select("team_registration_id").eq("match_id", game["match"]).execute().data}
        for t in game["teams"]:
            if t["reg"] not in have:
                db.table("match_lineups").insert({"match_id": game["match"], "team_registration_id": t["reg"], "status": "CONFIRMED"}).execute()
    r = game["org"].post(f"{game['base']}/referee/state", json={"idempotency_key": str(uuid4()), "new_state": state})
    assert r.status_code == 200, r.text


def goal(game, side):
    team = game["teams"][0 if side == "home" else 1]
    ev = {"id": str(uuid4()), "event_type": "SHOT", "period": "FIRST_HALF", "elapsed_seconds": 30, "display_minute": 0, "display_second": 30,
          "actor_player_id": team["players"][0], "actor_registration_id": team["reg"], "metadata": {"result": "GOAL"}}
    r = game["org"].post(f"{game['base']}/timeline/event", json=ev)
    assert r.status_code == 200, r.text
    return ev["id"]


def board(game, who=None):
    r = game["client"].get(f"/api/v1/predictions/matches/{game['match']}", headers=who["h"] if who else {})
    assert r.status_code == 200, r.text
    return r.json()


def market(b, kind, goal_no=None):
    return next(m for m in b["markets"] if m["kind"] == kind and (goal_no is None or m["params"].get("goal_no") == goal_no))


def odds_of(m, key):
    return next(o["odds"] for o in m["options"] if o["key"] == key)


def bet(game, who, m, key, stake, odds=None, idem=None, expect=200):
    r = game["client"].post(f"/api/v1/predictions/matches/{game['match']}/bets", headers=who["h"], json={
        "market_id": m["id"], "selection": key, "stake": stake, "odds": odds or odds_of(m, key), **({"idempotency_key": idem} if idem else {})})
    assert r.status_code == expect, r.text
    return r.json()


def wallet(game, who):
    return game["client"].get("/api/v1/predictions/wallet", headers=who["h"]).json()


def ledger_matches_wallet(who):
    total = sum(r["delta"] for r in db.table("bet_ledger").select("delta").eq("user_id", who["id"]).execute().data)
    return total == db.table("bet_wallets").select("balance").eq("user_id", who["id"]).execute().data[0]["balance"]


def test_odds_are_public_but_betting_needs_an_account(game):
    b = board(game)
    assert {m["kind"] for m in b["markets"]} == {"MATCH_RESULT", "NEXT_GOAL", "TOTAL_GOALS"}
    assert all(o["odds"] and o["odds"] > 1 for m in b["markets"] for o in m["options"])
    assert b["eligible"]["ok"] is False and b["my_bets"] == []
    r = game["client"].post(f"/api/v1/predictions/matches/{game['match']}/bets", json={"market_id": str(uuid4()), "selection": "HOME", "stake": 10, "odds": 2})
    assert r.status_code in (401, 422)


def test_new_players_get_starter_coins_and_stakes_are_checked(game):
    a = game["bettors"][0]
    assert wallet(game, a) == {"balance": 1000, "can_refill": False}
    m = market(board(game, a), "MATCH_RESULT")
    bet(game, a, m, "HOME", 500)
    bet(game, a, m, "HOME", 100)
    assert wallet(game, a)["balance"] == 400
    err = bet(game, a, m, "AWAY", 500, expect=400)
    assert err["detail"]["code"] == "INSUFFICIENT_COINS"
    assert bet(game, a, m, "AWAY", 501, expect=422) is not None  # over the per-bet cap
    assert ledger_matches_wallet(a)


def test_retries_do_not_double_charge_and_stale_odds_are_refused(game):
    a = game["bettors"][0]
    m = market(board(game, a), "MATCH_RESULT")
    key = str(uuid4())
    first = bet(game, a, m, "HOME", 100, idem=key)
    again = bet(game, a, m, "HOME", 100, idem=key)
    assert first["bet_id"] == again["bet_id"] and wallet(game, a)["balance"] == 900
    stale = bet(game, a, m, "HOME", 50, odds=odds_of(m, "HOME") + 3, expect=409)
    assert stale["detail"]["code"] == "ODDS_CHANGED" and stale["detail"]["odds"] > 1


def test_people_running_or_playing_the_match_cannot_bet_on_it(game, users):
    org_h = game["org"]
    # the event owner is staff for this event
    token_owner = users["ORGANIZER"]["token"]
    owner = {"id": users["ORGANIZER"]["id"], "h": {"Authorization": f"Bearer {token_owner}"}}
    b = board(game, owner)
    assert b["eligible"]["ok"] is False and "run this event" in b["eligible"]["reason"]
    captain = {"id": users["CAPTAIN"]["id"], "h": {"Authorization": f"Bearer {users['CAPTAIN']['token']}"}}
    assert "play in this match" in board(game, captain)["eligible"]["reason"]
    m = market(board(game, game["bettors"][0]), "MATCH_RESULT")
    bet(game, captain, m, "HOME", 10, odds=odds_of(m, "HOME"), expect=403)


def test_live_goals_settle_next_goal_bets_and_undo_repairs_the_wallets(game):
    go(game, "READY"); go(game, "LIVE")
    a, b = game["bettors"]
    ng = market(board(game, a), "NEXT_GOAL", 1)
    pa = bet(game, a, ng, "HOME", 100)
    bet(game, b, ng, "AWAY", 100)
    assert wallet(game, a)["balance"] == 900 and wallet(game, b)["balance"] == 900

    goal_id = goal(game, "home")  # logged by the official: closes goal market 1 and opens market 2
    after = board(game, a)
    assert market(after, "NEXT_GOAL", 1)["status"] == "SETTLED" and market(after, "NEXT_GOAL", 1)["result"] == "HOME"
    assert market(after, "NEXT_GOAL", 2)["status"] == "OPEN"
    assert wallet(game, a)["balance"] == 900 + pa["potential_payout"]
    assert wallet(game, b)["balance"] == 900
    won = {x["id"]: x for x in after["my_bets"]}[pa["bet_id"]]
    assert won["status"] == "WON" and won["payout"] == pa["potential_payout"]

    # the recorder undoes it: A's win is taken back, B's loss is undone, the market is open again
    r = game["org"].delete(f"{game['base']}/timeline/event/{goal_id}")
    assert r.status_code == 200, r.text
    again = board(game, a)
    assert market(again, "NEXT_GOAL", 1)["status"] == "OPEN"
    assert wallet(game, a)["balance"] == 900 and wallet(game, b)["balance"] == 900
    assert {x["status"] for x in again["my_bets"]} == {"PENDING"}
    assert ledger_matches_wallet(a) and ledger_matches_wallet(b)


def test_full_time_settles_result_and_totals_and_the_leaderboard_ranks_by_profit(game):
    go(game, "READY"); go(game, "LIVE")
    a, b = game["bettors"]
    res = market(board(game, a), "MATCH_RESULT")
    tot = market(board(game, a), "TOTAL_GOALS")
    bet(game, a, res, "HOME", 200)
    bet(game, b, res, "AWAY", 200)
    over = bet(game, a, tot, "OVER", 100)
    goal(game, "home"); goal(game, "home")
    go(game, "FULL_TIME")
    assert board(game, a)["suspended"]["reason"] == "Match is over"
    final = board(game, a)
    assert market(final, "MATCH_RESULT")["result"] == "HOME"
    assert wallet(game, a)["balance"] > 1000 - 300  # got paid on the result bet
    statuses = {x["selection"]: x["status"] for x in final["my_bets"]}
    assert statuses["HOME"] == "WON"
    assert ledger_matches_wallet(a) and ledger_matches_wallet(b)

    lb = game["client"].get(f"/api/v1/predictions/leaderboard?event_id={game['event']}").json()
    ids = [r["user_id"] for r in lb]
    assert ids.index(a["id"]) < ids.index(b["id"])
    top = next(r for r in lb if r["user_id"] == a["id"])
    assert top["profit"] > 0 and top["bets_won"] >= 1 and top["win_rate"] > 0
    assert next(r for r in lb if r["user_id"] == b["id"])["profit"] == -200

    db.table("user_privacy_settings").update({"profile_public": False}).eq("user_id", b["id"]).execute()
    lb = game["client"].get(f"/api/v1/predictions/leaderboard?event_id={game['event']}").json()
    assert next(r for r in lb if r["user_id"] == b["id"])["display_name"] == "Anonymous player"


def test_abandoned_matches_refund_every_stake(game):
    go(game, "READY"); go(game, "LIVE")
    a = game["bettors"][0]
    bet(game, a, market(board(game, a), "MATCH_RESULT"), "DRAW", 250)
    assert wallet(game, a)["balance"] == 750
    go(game, "ABANDONED")
    assert wallet(game, a)["balance"] == 1000
    assert ledger_matches_wallet(a)


def test_betting_freezes_right_after_a_shot_and_when_officials_pause_it(game, monkeypatch):
    monkeypatch.setattr(betting_module, "SUSPEND_AFTER_SHOT_SECONDS", 8)
    go(game, "READY"); go(game, "LIVE")
    a = game["bettors"][0]
    m = market(board(game, a), "NEXT_GOAL")
    shot = {"id": str(uuid4()), "event_type": "SHOT", "period": "FIRST_HALF", "elapsed_seconds": 5, "display_minute": 0, "display_second": 5,
            "actor_player_id": game["teams"][0]["players"][0], "actor_registration_id": game["teams"][0]["reg"], "metadata": {"result": "SAVED"}}
    game["org"].post(f"{game['base']}/timeline/event", json=shot)
    assert bet(game, a, m, "HOME", 10, odds=1.1, expect=409)["detail"]["code"] == "SUSPENDED"

    monkeypatch.setattr(betting_module, "SUSPEND_AFTER_SHOT_SECONDS", 0)
    assert game["client"].post(f"/api/v1/predictions/matches/{game['match']}/pause", headers=a["h"], json={"paused": True}).status_code == 403  # fans cannot
    assert game["org"].post(f"/api/v1/predictions/matches/{game['match']}/pause", json={"paused": True}).status_code == 200
    assert board(game, a)["suspended"]["reason"].startswith("Paused")
    game["org"].post(f"/api/v1/predictions/matches/{game['match']}/pause", json={"paused": False})
    assert board(game, a)["suspended"] is None


def test_refill_only_for_broke_players_with_nothing_pending(game):
    a = game["bettors"][0]
    r = game["client"].post("/api/v1/predictions/wallet/refill", headers=a["h"])
    assert r.status_code == 400 and r.json()["detail"]["code"] == "REFILL_NOT_AVAILABLE"
    db.rpc("bet_ensure_wallet", {"p_user": a["id"]}).execute()
    db.table("bet_wallets").update({"balance": 20}).eq("user_id", a["id"]).execute()
    db.table("bet_ledger").insert({"user_id": a["id"], "delta": -980, "reason": "STAKE"}).execute()  # keep balance = sum(ledger)
    ok = game["client"].post("/api/v1/predictions/wallet/refill", headers=a["h"])
    assert ok.status_code == 200 and ok.json()["balance"] == 320
    assert game["client"].post("/api/v1/predictions/wallet/refill", headers=a["h"]).status_code == 400  # only once a day


def test_coins_cannot_be_edited_from_the_browser(game):
    a = game["bettors"][0]
    wallet(game, a)
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"])
    sb.postgrest.auth(a["h"]["Authorization"].split()[1])
    from postgrest.exceptions import APIError
    for table, payload in (("bet_wallets", {"balance": 999999}), ("bet_ledger", {"delta": 5, "reason": "REFILL"})):
        with pytest.raises(APIError):
            (sb.table(table).update(payload).eq("user_id", a["id"]) if table == "bet_wallets" else sb.table(table).insert({"user_id": a["id"], **payload})).execute()
    assert sb.table("bet_wallets").select("balance").execute().data == [{"balance": 1000}]
    assert sb.rpc("bet_leaderboard", {}).execute().data is not None  # the public board is readable
    with pytest.raises(APIError):
        sb.rpc("bet_refill", {"p_user": a["id"]}).execute()  # money functions are service-role only
