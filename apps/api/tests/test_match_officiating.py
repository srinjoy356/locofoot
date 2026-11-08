"""Lineups, referee events and participation over HTTP (replaces the old direct-service phase 4 test)."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.supabase_client import supabase_admin as db


@pytest.fixture
def match(auth_client, users):
    org = auth_client("ORGANIZER")
    ev = org.post("/api/v1/events", json={"name": f"TEST__OFF__{uuid4().hex[:8]}", "description": "x"}).json()
    eid = ev["id"]
    db.table("events").update({"status": "LIVE"}).eq("id", eid).execute()
    base = datetime.now(timezone.utc)
    teams = []
    for i, captain in enumerate(("CAPTAIN", "SECOND_CAPTAIN")):
        reg = db.table("event_team_registrations").insert({
            "event_id": eid, "team_name": f"Team {i}", "status": "APPROVED", "captain_id": users[captain]["id"],
            "registered_at": (base + timedelta(seconds=i)).isoformat()}).execute().data[0]
        pl = db.table("event_team_players").insert(
            [{"event_registration_id": reg["id"], "guest_name": f"T{i}P{j}", "status": "APPROVED"} for j in range(3)]).execute().data
        teams.append({"reg": reg["id"], "players": [p["id"] for p in pl]})
    m = db.table("matches").insert({"event_id": eid, "home_registration_id": teams[0]["reg"], "away_registration_id": teams[1]["reg"]}).execute().data[0]
    yield {"event": eid, "match": m["id"], "teams": teams}
    db.table("events").delete().eq("id", eid).execute()


def lineup(team, roles=("STARTER", "STARTER", "SUBSTITUTE")):
    return {"team_registration_id": team["reg"],
            "players": [{"event_team_player_id": p, "lineup_role": r} for p, r in zip(team["players"], roles)]}


def base(m):
    return f"/api/v1/events/{m['event']}/matches/{m['match']}"


def test_only_a_teams_own_captain_or_staff_manage_its_lineup(match, auth_client):
    home, away = match["teams"]
    url = f"{base(match)}/lineups/submit"
    r = auth_client("SECOND_CAPTAIN").post(url, json=lineup(home)); assert r.status_code == 403, r.text  # rival captain
    assert auth_client("UNAUTHORIZED_USER").post(url, json=lineup(home)).status_code == 403
    assert auth_client("CAPTAIN").post(url, json=lineup(home)).status_code == 200
    assert auth_client("ORGANIZER").post(url, json=lineup(away)).status_code == 200  # staff may submit for any team
    assert auth_client("SECOND_CAPTAIN").post(f"{base(match)}/lineups/confirm", params={"team_registration_id": home["reg"]}).status_code == 403
    assert auth_client("CAPTAIN").post(f"{base(match)}/lineups/confirm", params={"team_registration_id": home["reg"]}).status_code == 200
    # a team that is not in this match cannot be lined up
    outsider = {"reg": str(uuid4()), "players": home["players"]}
    assert auth_client("ORGANIZER").post(url, json=lineup(outsider)).status_code == 400


def test_confirmed_lineups_seed_participation_and_two_yellows_send_off(match, auth_client):
    home, away = match["teams"]
    org, cap, cap2 = auth_client("ORGANIZER"), auth_client("CAPTAIN"), auth_client("SECOND_CAPTAIN")
    for client, team in ((cap, home), (cap2, away)):
        assert client.post(f"{base(match)}/lineups/submit", json=lineup(team)).status_code == 200
        assert client.post(f"{base(match)}/lineups/confirm", params={"team_registration_id": team["reg"]}).status_code == 200
    for state in ("READY", "LIVE"):
        assert org.post(f"{base(match)}/referee/state", json={"idempotency_key": str(uuid4()), "new_state": state}).status_code == 200

    part = db.table("match_participation").select("event_player_id, status").eq("match_id", match["match"]).execute().data
    assert {p["status"] for p in part} == {"STARTER", "SUBSTITUTE"} and len(part) == 6

    player = home["players"][0]
    for n in range(2):
        res = org.post(f"{base(match)}/referee/event", json={
            "id": str(uuid4()), "event_type": "YELLOW_CARD", "period": "FIRST_HALF", "elapsed_seconds": 100 + n,
            "display_minute": 1, "display_second": n, "event_player_id": player, "event_registration_id": home["reg"],
            "metadata": {"reason": "FOUL_PLAY"}})
        assert res.status_code == 200, res.text
    kinds = [e["event_type"] for e in db.table("referee_events").select("event_type").eq("match_id", match["match"]).execute().data]
    assert kinds.count("RED_CARD") == 1  # second yellow becomes a red
    status = db.table("match_participation").select("status").eq("match_id", match["match"]).eq("event_player_id", player).execute().data[0]["status"]
    assert status == "SENT_OFF"

    bad = org.post(f"{base(match)}/referee/event", json={
        "id": str(uuid4()), "event_type": "FOUL", "period": "FIRST_HALF", "elapsed_seconds": 5, "display_minute": 0,
        "display_second": 5, "event_player_id": str(uuid4()), "event_registration_id": home["reg"]})
    assert bad.status_code == 400  # unknown player is reported, not swallowed


def test_the_assigned_referee_confirms_lineups_but_an_unassigned_user_cannot(match, auth_client, users):
    home, _ = match["teams"]
    assert auth_client("CAPTAIN").post(f"{base(match)}/lineups/submit", json=lineup(home)).status_code == 200
    confirm = lambda who: auth_client(who).post(f"{base(match)}/lineups/confirm", params={"team_registration_id": home["reg"]})
    assert confirm("PLAYER_NON_FRIEND").status_code == 403
    db.table("match_referees").insert({"match_id": match["match"], "user_id": users["PLAYER_FRIEND"]["id"], "status": "ACCEPTED"}).execute()
    assert confirm("PLAYER_FRIEND").status_code == 200


def test_a_scorer_logs_play_but_cannot_run_the_match(match, auth_client, users):
    # the recorder UI is open to scorers, the referee console is not: the API must agree
    home, away = match["teams"]
    for client, team in ((auth_client("CAPTAIN"), home), (auth_client("SECOND_CAPTAIN"), away)):
        assert client.post(f"{base(match)}/lineups/submit", json=lineup(team)).status_code == 200
        assert client.post(f"{base(match)}/lineups/confirm", params={"team_registration_id": team["reg"]}).status_code == 200
    db.table("event_roles").insert({"event_id": match["event"], "user_id": users["PLAYER_FRIEND"]["id"], "role": "SCORER"}).execute()
    scorer = auth_client("PLAYER_FRIEND")
    assert auth_client("ORGANIZER").post(f"{base(match)}/referee/state", json={"idempotency_key": str(uuid4()), "new_state": "READY"}).status_code == 200
    assert auth_client("ORGANIZER").post(f"{base(match)}/referee/state", json={"idempotency_key": str(uuid4()), "new_state": "LIVE"}).status_code == 200

    shot = {"id": str(uuid4()), "event_type": "PASS", "period": "FIRST_HALF", "elapsed_seconds": 5, "display_minute": 0, "display_second": 5,
            "actor_player_id": home["players"][0], "actor_registration_id": home["reg"], "metadata": {}}
    assert scorer.post(f"{base(match)}/timeline/event", json=shot).status_code == 200
    assert scorer.post(f"{base(match)}/referee/state", json={"idempotency_key": str(uuid4()), "new_state": "HALF_TIME"}).status_code == 403
    assert scorer.post(f"{base(match)}/referee/forfeit", json={"idempotency_key": str(uuid4()), "forfeiting_team": "home", "reason": "x"}).status_code == 403
    card = {"id": str(uuid4()), "event_type": "RED_CARD", "period": "FIRST_HALF", "elapsed_seconds": 9, "display_minute": 0, "display_second": 9,
            "event_player_id": home["players"][0], "event_registration_id": home["reg"], "metadata": {}}
    assert scorer.post(f"{base(match)}/referee/event", json=card).status_code == 403
