"""Recording live events over HTTP: authorization, honest error reporting, idempotent retries, bracket progression."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.supabase_client import supabase_admin as db


@pytest.fixture
def knockout(auth_client, users):
    org = auth_client("ORGANIZER")
    ev = org.post("/api/v1/events", json={"name": f"TEST__REC__{uuid4().hex[:8]}", "description": "rec"}).json()
    eid = ev["id"]
    db.table("events").update({"status": "LIVE"}).eq("id", eid).execute()
    base = datetime.now(timezone.utc)
    teams = []
    for i in range(4):
        reg = db.table("event_team_registrations").insert({
            "event_id": eid, "team_name": f"Team {i}", "team_short_name": f"T{i}", "status": "APPROVED",
            "captain_id": users["ORGANIZER"]["id"], "registered_at": (base + timedelta(seconds=i)).isoformat()}).execute().data[0]
        players = db.table("event_team_players").insert(
            [{"event_registration_id": reg["id"], "guest_name": f"T{i} P{j}", "status": "APPROVED"} for j in range(2)]).execute().data
        teams.append({"reg": reg["id"], "players": [p["id"] for p in players]})
    res = org.post(f"/api/v1/events/{eid}/fixtures/generate", json={
        "idempotency_key": str(uuid4()), "tournament_format": "KNOCKOUT", "third_place": False})
    assert res.status_code == 200, res.text
    sf1 = db.table("brackets").select("match_id").eq("event_id", eid).eq("round_name", "SF").eq("position", 1).execute().data[0]["match_id"]
    yield {"event": eid, "teams": teams, "sf1": sf1}
    db.table("events").delete().eq("id", eid).execute()


def goal(team, **kw):
    return {"id": str(uuid4()), "event_type": "SHOT", "period": "FIRST_HALF", "elapsed_seconds": 90,
            "display_minute": 1, "display_second": 30, "x": 50, "y": 10,
            "actor_player_id": team["players"][0], "actor_registration_id": team["reg"],
            "metadata": {"result": "GOAL"}, **kw}


def state(client, ev, match, new_state):
    return client.post(f"/api/v1/events/{ev}/matches/{match}/referee/state",
                       json={"idempotency_key": str(uuid4()), "new_state": new_state})


def confirm_lineups(match):
    """Both teams have a confirmed lineup, which kick-off requires."""
    row = db.table("matches").select("home_registration_id, away_registration_id").eq("id", match).execute().data[0]
    for reg in (row["home_registration_id"], row["away_registration_id"]):
        db.table("match_lineups").insert({"match_id": match, "team_registration_id": reg, "status": "CONFIRMED"}).execute()


def test_only_officials_can_record(knockout, auth_client):
    ev, m = knockout["event"], knockout["sf1"]
    home = db.table("matches").select("home_registration_id").eq("id", m).execute().data[0]["home_registration_id"]
    team = next(t for t in knockout["teams"] if t["reg"] == home)
    url = f"/api/v1/events/{ev}/matches/{m}/timeline/event"
    assert auth_client("UNAUTHORIZED_USER").post(url, json=goal(team)).status_code == 403
    assert auth_client("CAPTAIN").post(url, json=goal(team)).status_code == 403
    assert state(auth_client("UNAUTHORIZED_USER"), ev, m, "LIVE").status_code == 403
    assert auth_client("ORGANIZER").post(url, json=goal(team)).status_code == 200


def test_wrong_event_in_url_is_rejected(knockout, auth_client):
    other = auth_client("ORGANIZER").post("/api/v1/events", json={"name": f"TEST__REC__{uuid4().hex[:8]}", "description": "x"}).json()
    try:
        res = state(auth_client("ORGANIZER"), other["id"], knockout["sf1"], "LIVE")
        assert res.status_code == 404  # organizer of event B cannot drive event A's match through B's URL
    finally:
        db.table("events").delete().eq("id", other["id"]).execute()


def test_recording_is_honest_and_idempotent(knockout, auth_client):
    ev, m = knockout["event"], knockout["sf1"]
    org = auth_client("ORGANIZER")
    row = db.table("matches").select("home_registration_id").eq("id", m).execute().data[0]
    team = next(t for t in knockout["teams"] if t["reg"] == row["home_registration_id"])
    url = f"/api/v1/events/{ev}/matches/{m}/timeline/event"

    payload = goal(team)
    assert org.post(url, json=payload).json()["status"] == "success"
    again = org.post(url, json=payload)  # a retry after a lost response
    assert again.status_code == 200 and again.json().get("duplicate") is True
    assert len(db.table("match_timeline_events").select("id").eq("match_id", m).execute().data) == 1
    assert db.table("matches").select("home_score").eq("id", m).execute().data[0]["home_score"] == 1

    bad = org.post(url, json=goal(team, actor_player_id=str(uuid4())))  # unknown player must fail loudly
    assert bad.status_code == 400, bad.text


def test_completing_a_semi_final_fills_the_final(knockout, auth_client):
    ev, m = knockout["event"], knockout["sf1"]
    org = auth_client("ORGANIZER")
    row = db.table("matches").select("home_registration_id").eq("id", m).execute().data[0]
    team = next(t for t in knockout["teams"] if t["reg"] == row["home_registration_id"])
    assert org.post(f"/api/v1/events/{ev}/matches/{m}/timeline/event", json=goal(team)).status_code == 200
    confirm_lineups(m)
    for s in ("READY", "LIVE", "FULL_TIME", "COMPLETED"):
        assert state(org, ev, m, s).status_code == 200, s
    final = db.table("brackets").select("match_id").eq("event_id", ev).eq("round_name", "FINAL").execute().data[0]["match_id"]
    assert db.table("matches").select("home_registration_id").eq("id", final).execute().data[0]["home_registration_id"] == team["reg"]


def test_undo_removes_event_audits_it_and_fixes_the_score(knockout, auth_client):
    ev, m = knockout["event"], knockout["sf1"]
    org = auth_client("ORGANIZER")
    row = db.table("matches").select("home_registration_id").eq("id", m).execute().data[0]
    team = next(t for t in knockout["teams"] if t["reg"] == row["home_registration_id"])
    payload = goal(team)
    base = f"/api/v1/events/{ev}/matches/{m}/timeline/event"
    assert org.post(base, json=payload).status_code == 200
    assert db.table("matches").select("home_score").eq("id", m).execute().data[0]["home_score"] == 1

    assert auth_client("CAPTAIN").delete(f"{base}/{payload['id']}").status_code == 403
    assert org.delete(f"{base}/{payload['id']}").status_code == 200
    assert db.table("matches").select("home_score").eq("id", m).execute().data[0]["home_score"] == 0  # stats recompute
    assert db.table("match_timeline_events").select("id").eq("id", payload["id"]).execute().data == []
    audit = db.table("audit_logs").select("old_value").eq("entity_id", payload["id"]).eq("action", "UNDO_TIMELINE_EVENT").execute().data
    assert audit and audit[0]["old_value"]["event_type"] == "SHOT"
    assert org.delete(f"{base}/{payload['id']}").status_code == 404  # already gone


def test_quick_match_scorer_can_record_but_strangers_cannot(auth_client, users):
    org = auth_client("ORGANIZER")
    res = org.post("/api/v1/quick-match", json={
        "match_name": f"TEST__QUICK__{uuid4().hex[:6]}", "scorer_id": users["PLAYER_FRIEND"]["unique_code"],
        "team_a": {"name": "A", "players": [{"guest_name": "A1", "jersey_number": 1}, {"guest_name": "A2", "jersey_number": 2}]},
        "team_b": {"name": "B", "players": [{"guest_name": "B1", "jersey_number": 1}]}})
    assert res.status_code == 201, res.text
    event_id, match_id = res.json()["event_id"], res.json()["match_id"]
    try:
        m = db.table("matches").select("home_registration_id").eq("id", match_id).execute().data[0]
        player = db.table("event_team_players").select("id").eq("event_registration_id", m["home_registration_id"]).execute().data[0]["id"]
        url = f"/api/v1/events/{event_id}/matches/{match_id}/timeline/event"
        payload = {"id": str(uuid4()), "event_type": "PASS", "period": "FIRST_HALF", "elapsed_seconds": 5, "display_minute": 0,
                   "display_second": 5, "actor_player_id": player, "actor_registration_id": m["home_registration_id"], "metadata": {}}
        assert auth_client("PLAYER_FRIEND").post(url, json=payload).status_code == 200  # the scorer named at creation
        assert auth_client("PLAYER_NON_FRIEND").post(url, json={**payload, "id": str(uuid4())}).status_code == 403
    finally:
        db.table("events").delete().eq("id", event_id).execute()


def test_bulk_endpoint_records_a_burst_isolates_bad_events_and_ignores_retries(knockout, auth_client):
    ev, m = knockout["event"], knockout["sf1"]
    org = auth_client("ORGANIZER")
    row = db.table("matches").select("home_registration_id").eq("id", m).execute().data[0]
    team = next(t for t in knockout["teams"] if t["reg"] == row["home_registration_id"])
    url = f"/api/v1/events/{ev}/matches/{m}/timeline/events"

    burst = [goal(team, elapsed_seconds=10 + i, display_second=10 + i, metadata={"result": "GOAL" if i == 2 else "SAVED"}) for i in range(5)]
    res = org.post(url, json={"events": burst})
    assert res.status_code == 200, res.text
    assert [r["status"] for r in res.json()["results"]] == ["ok"] * 5
    assert len(db.table("match_timeline_events").select("id").eq("match_id", m).execute().data) == 5
    assert db.table("matches").select("home_score").eq("id", m).execute().data[0]["home_score"] == 1

    # the same burst again (a lost response): nothing doubles
    assert org.post(url, json={"events": burst}).status_code == 200
    assert len(db.table("match_timeline_events").select("id").eq("match_id", m).execute().data) == 5

    # one event naming an unknown player must not take the good ones down with it
    mixed = [goal(team), goal(team, actor_player_id=str(uuid4())), goal(team)]
    out = org.post(url, json={"events": mixed}).json()["results"]
    assert [r["status"] for r in out] == ["ok", "error", "ok"]
    assert len(db.table("match_timeline_events").select("id").eq("match_id", m).execute().data) == 7

    assert auth_client("CAPTAIN").post(url, json={"events": burst}).status_code == 403
    assert org.post(url, json={"events": []}).status_code == 422


def test_kick_off_needs_both_lineups_confirmed(knockout, auth_client):
    ev, m = knockout["event"], knockout["sf1"]
    org = auth_client("ORGANIZER")
    res = state(org, ev, m, "LIVE")
    assert res.status_code == 409 and "Confirm the lineup" in res.json()["detail"]
    assert db.table("matches").select("match_state").eq("id", m).execute().data[0]["match_state"] == "SCHEDULED"
    confirm_lineups(m)
    assert state(org, ev, m, "LIVE").status_code == 200


def test_the_state_machine_refuses_impossible_moves(knockout, auth_client):
    ev, m = knockout["event"], knockout["sf1"]
    org = auth_client("ORGANIZER")
    assert state(org, ev, m, "COMPLETED").status_code == 409        # cannot finish a match that never started
    confirm_lineups(m)
    assert state(org, ev, m, "LIVE").status_code == 200
    assert state(org, ev, m, "LIVE").status_code == 200             # repeating the current state is harmless
    assert state(org, ev, m, "SCHEDULED").status_code == 409        # a started match cannot be un-started
    assert state(org, ev, m, "FULL_TIME").status_code == 200 and state(org, ev, m, "COMPLETED").status_code == 200
    assert state(org, ev, m, "LIVE").status_code == 409             # a finished match stays finished
