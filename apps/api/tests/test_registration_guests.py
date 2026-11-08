"""Captains can field players who have no account; the rules around locking, caps and duplicates still hold."""
from uuid import uuid4

import pytest

from app.core.supabase_client import supabase_admin as db


@pytest.fixture
def draft_team(auth_client, users):
    org = auth_client("ORGANIZER")
    ev = org.post("/api/v1/events", json={"name": f"TEST__GUESTS__{uuid4().hex[:8]}", "description": "g"}).json()
    db.table("events").update({"status": "REGISTRATION_OPEN"}).eq("id", ev["id"]).execute()
    db.table("event_settings").update({"max_squad": 3}).eq("event_id", ev["id"]).execute()
    cap = auth_client("CAPTAIN")
    reg = cap.post(f"/api/v1/events/{ev['id']}/registrations", json={"team_name": "Guests FC", "team_short_name": "GFC"}).json()
    yield {"event": ev["id"], "reg": reg["id"], "cap": cap, "org": org, "other": auth_client("SECOND_CAPTAIN")}
    db.table("events").delete().eq("id", ev["id"]).execute()


def test_captain_adds_and_removes_a_guest_player(draft_team):
    url = f"/api/v1/events/{draft_team['event']}/registrations/{draft_team['reg']}"
    added = draft_team["cap"].post(f"{url}/guest-players", json={"guest_name": "  Ravi Kumar  ", "jersey_number": 9})
    assert added.status_code == 201 and added.json()["guest_name"] == "Ravi Kumar" and added.json()["user_id"] is None
    squad = draft_team["cap"].get(f"{url}/squad").json()
    assert sorted(p["guest_name"] or "captain" for p in squad) == ["Ravi Kumar", "captain"]
    assert draft_team["cap"].delete(f"{url}/guest-players/{added.json()['id']}").status_code == 200
    assert len(draft_team["cap"].get(f"{url}/squad").json()) == 1


def test_guest_rules_are_enforced(draft_team):
    url = f"/api/v1/events/{draft_team['event']}/registrations/{draft_team['reg']}/guest-players"
    cap = draft_team["cap"]
    assert cap.post(url, json={"guest_name": "A", "jersey_number": 4}).status_code == 201
    assert cap.post(url, json={"guest_name": "B", "jersey_number": 4}).status_code == 400   # jersey taken
    assert cap.post(url, json={"guest_name": "a"}).status_code == 400                       # same name
    assert cap.post(url, json={"guest_name": "   "}).status_code in (400, 422)               # blank
    assert cap.post(url, json={"guest_name": "C", "jersey_number": 120}).status_code == 422  # out of range
    assert cap.post(url, json={"guest_name": "C"}).status_code == 201                        # squad is now 3 of 3
    assert cap.post(url, json={"guest_name": "D"}).status_code == 400                        # squad cap


def test_only_the_captain_can_change_an_open_squad_and_a_lock_stops_everyone(draft_team):
    base = f"/api/v1/events/{draft_team['event']}/registrations/{draft_team['reg']}"
    assert draft_team["other"].post(f"{base}/guest-players", json={"guest_name": "Intruder"}).status_code == 403
    assert draft_team["org"].post(f"{base}/lock").status_code == 200
    assert draft_team["cap"].post(f"{base}/guest-players", json={"guest_name": "Late"}).status_code == 400


def test_organizer_seeds_teams_and_duplicates_are_refused(draft_team):
    url = f"/api/v1/events/{draft_team['event']}/registrations/{draft_team['reg']}/seed"
    assert draft_team["cap"].put(url, json={"seed": 1}).status_code == 403          # captains cannot seed themselves
    assert draft_team["org"].put(url, json={"seed": 2}).json()["seed"] == 2
    captain_id = db.table("event_team_registrations").select("captain_id").eq("id", draft_team["reg"]).execute().data[0]["captain_id"]
    other = db.table("event_team_registrations").insert({"event_id": draft_team["event"], "team_name": "Rivals", "status": "APPROVED", "captain_id": captain_id}).execute().data[0]
    other_url = f"/api/v1/events/{draft_team['event']}/registrations/{other['id']}/seed"
    assert draft_team["org"].put(other_url, json={"seed": 2}).status_code == 409    # seed already taken
    assert draft_team["org"].put(other_url, json={"seed": 0}).status_code == 422    # out of range
    assert draft_team["org"].put(url, json={"seed": None}).json()["seed"] is None   # cleared
