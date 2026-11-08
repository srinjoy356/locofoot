"""
End-to-end check of the group + knockout engine against the real database.
Creates a throwaway TEST__ event owned by an existing user and deletes it afterwards.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.core.supabase_client import supabase_admin as db
from app.schemas.events import EventCreate
from app.schemas.scheduling import GenerateFixturesRequest, ScheduleNextRequest
from app.services.event_service import EventService
from app.services.scheduling_service import scheduling_service
from app.services.tournament_service import tournament_service


@pytest.fixture
def owner_id():
    user = db.auth.admin.create_user({"email": f"flow_{uuid4().hex[:8]}@example.com", "password": "TestPassword123!",
                                      "email_confirm": True})
    yield user.user.id
    db.auth.admin.delete_user(user.user.id)


@pytest.fixture
def event(owner_id):
    ev = EventService.create_event(EventCreate(name=f"TEST__FLOW__{uuid4().hex[:8]}", description="flow test"), owner_id)
    db.table("events").update({"status": "REGISTRATION_OPEN", "scheduling_state": "NOT_STARTED"}).eq("id", ev["id"]).execute()
    yield ev
    db.table("events").delete().eq("id", ev["id"]).execute()


def add_teams(event_id, owner_id, n):
    base = datetime.now(timezone.utc)
    return [db.table("event_team_registrations").insert({
        "event_id": event_id, "team_name": f"Team {i}", "team_short_name": f"T{i}", "status": "APPROVED",
        "captain_id": owner_id, "registered_at": (base + timedelta(seconds=i)).isoformat(),
    }).execute().data[0] for i in range(n)]


def request(**kw):
    return GenerateFixturesRequest(idempotency_key=uuid4(), **kw)


def finish(match_id, home, away, winner=None):
    db.table("matches").update({"match_state": "COMPLETED", "status": "COMPLETED", "home_score": home,
                                "away_score": away}).eq("id", match_id).execute()


def finish_by_seed(rows_by_id, matches):
    """Lower team index wins 1-0 (team names are 'Team <i>')."""
    for m in matches:
        h, a = rows_by_id[m["home_registration_id"]], rows_by_id[m["away_registration_id"]]
        finish(m["id"], *((1, 0) if h < a else (0, 1)))


def test_group_knockout_full_progression(event, owner_id):
    teams = add_teams(event["id"], owner_id, 8)
    idx = {t["id"]: i for i, t in enumerate(teams)}
    res = tournament_service.generate(UUID(event["id"]), request(
        tournament_format="GROUP_KNOCKOUT", group_count=2, advance_per_group=2, third_place=True), UUID(owner_id))
    assert res["fixture_count"] == 16  # 2 x 6 group games + SF, SF, FINAL, THIRD_PLACE

    matches = db.table("matches").select("*").eq("event_id", event["id"]).execute().data
    group_games = [m for m in matches if m["group_id"]]
    assert len(group_games) == 12 and all(m["home_registration_id"] for m in group_games)
    ko = [m for m in matches if m["bracket_id"]]
    assert len(ko) == 4 and all(m["home_registration_id"] is None for m in ko)  # placeholders until groups finish

    # Group tables resolve only when the whole group is complete; finish group A first
    groups = db.table("groups").select("*").eq("event_id", event["id"]).order("name").execute().data
    assert [g["name"] for g in groups] == ["Group A", "Group B"]
    finish_by_seed(idx, [m for m in group_games if m["group_id"] == groups[0]["id"]])
    # Each group resolves on its own: A1 and A2 are placed, the B slots stay open
    assert tournament_service.advance_bracket(UUID(event["id"])) == 2
    half = {b["round_name"] + str(b["position"]): b for b in tournament_service.bracket(UUID(event["id"]))}
    assert half["SF1"]["home"]["name"] == "Team 0" and half["SF1"]["away"]["name"] is None

    finish_by_seed(idx, [m for m in group_games if m["group_id"] == groups[1]["id"]])
    standings = tournament_service.group_standings(UUID(event["id"]))
    assert all(g["complete"] for g in standings)
    # snake split of seeds 0..7 -> A = {0,3,4,7}, B = {1,2,5,6}
    assert [r["team_name"] for r in standings[0]["rows"]] == ["Team 0", "Team 3", "Team 4", "Team 7"]
    assert [r["team_name"] for r in standings[1]["rows"]] == ["Team 1", "Team 2", "Team 5", "Team 6"]
    assert standings[0]["rows"][0]["points"] == 9

    assert tournament_service.advance_bracket(UUID(event["id"])) == 2  # the remaining B slots
    brackets = {b["round_name"] + str(b["position"]): b for b in tournament_service.bracket(UUID(event["id"]))}
    assert (brackets["SF1"]["home"]["name"], brackets["SF1"]["away"]["name"]) == ("Team 0", "Team 2")  # A1 v B2
    assert (brackets["SF2"]["home"]["name"], brackets["SF2"]["away"]["name"]) == ("Team 1", "Team 3")  # B1 v A2
    assert brackets["FINAL1"]["home"]["name"] is None and brackets["FINAL1"]["home"]["placeholder"] == "Winner of SF1"

    # SF1 decided on goals, SF2 drawn: nothing advances from SF2 until a winner is set
    sf1, sf2 = brackets["SF1"]["match_id"], brackets["SF2"]["match_id"]
    finish(sf1, 2, 0)
    finish(sf2, 1, 1)
    tournament_service.advance_bracket(UUID(event["id"]))
    after = {b["round_name"] + str(b["position"]): b for b in tournament_service.bracket(UUID(event["id"]))}
    assert after["FINAL1"]["home"]["name"] == "Team 0" and after["FINAL1"]["away"]["name"] is None
    assert after["THIRD_PLACE1"]["home"]["name"] == "Team 2"

    with pytest.raises(HTTPException):  # a team outside the match cannot be the winner
        tournament_service.set_winner(UUID(event["id"]), UUID(sf2), UUID(teams[7]["id"]), UUID(owner_id))
    with pytest.raises(HTTPException):  # decided matches take no manual winner
        tournament_service.set_winner(UUID(event["id"]), UUID(sf1), UUID(teams[0]["id"]), UUID(owner_id))

    with pytest.raises(HTTPException):  # shoot-out score contradicts the chosen winner
        tournament_service.set_winner(UUID(event["id"]), UUID(sf2), UUID(teams[3]["id"]), UUID(owner_id), 5, 3)
    with pytest.raises(HTTPException):  # a shoot-out cannot end level
        tournament_service.set_winner(UUID(event["id"]), UUID(sf2), UUID(teams[3]["id"]), UUID(owner_id), 4, 4)
    tournament_service.set_winner(UUID(event["id"]), UUID(sf2), UUID(teams[3]["id"]), UUID(owner_id), 3, 4)
    assert next(b for b in tournament_service.bracket(UUID(event["id"])) if b["match_id"] == sf2)["shootout"] == {"home": 3, "away": 4}
    final = {b["round_name"]: b for b in tournament_service.bracket(UUID(event["id"]))}
    assert (final["FINAL"]["home"]["name"], final["FINAL"]["away"]["name"]) == ("Team 0", "Team 3")
    assert (final["THIRD_PLACE"]["home"]["name"], final["THIRD_PLACE"]["away"]["name"]) == ("Team 2", "Team 1")

    # Started matches block a reset
    with pytest.raises(HTTPException):
        tournament_service.reset(UUID(event["id"]), UUID(owner_id))


def test_reset_then_regenerate_as_knockout(event, owner_id):
    add_teams(event["id"], owner_id, 6)
    eid, oid = UUID(event["id"]), UUID(owner_id)
    tournament_service.generate(eid, request(tournament_format="ROUND_ROBIN"), oid)
    with pytest.raises(HTTPException):  # cannot silently stack a second format on top
        tournament_service.generate(eid, request(tournament_format="KNOCKOUT"), oid)
    assert tournament_service.reset(eid, oid)["deleted_matches"] == 15

    res = tournament_service.generate(eid, request(tournament_format="KNOCKOUT", third_place=True), oid)
    assert res["fixture_count"] == 6  # 6 teams: 2 quarter-finals, 2 semi-finals, final, third place
    bracket = tournament_service.bracket(eid)
    qf = [b for b in bracket if b["round_name"] == "QF"]
    assert len(qf) == 2 and all(b["home"]["name"] and b["away"]["name"] for b in qf)  # real teams filled immediately
    sf = [b for b in bracket if b["round_name"] == "SF"]
    assert sum(1 for b in sf for side in ("home", "away") if b[side]["name"]) == 2  # seeds 1 and 2 have byes


def test_validation(event, owner_id):
    add_teams(event["id"], owner_id, 3)
    eid, oid = UUID(event["id"]), UUID(owner_id)
    with pytest.raises(HTTPException):
        tournament_service.generate(eid, request(tournament_format="GROUP_KNOCKOUT", group_count=2), oid)  # < 2 per group
    with pytest.raises(HTTPException):
        tournament_service.generate(eid, request(tournament_format="SWISS"), oid)
    with pytest.raises(HTTPException):  # non-admin
        tournament_service.generate(eid, request(tournament_format="ROUND_ROBIN"), uuid4())


def test_scheduler_places_knockout_after_groups(event, owner_id):
    add_teams(event["id"], owner_id, 4)
    eid, oid = UUID(event["id"]), UUID(owner_id)
    tournament_service.generate(eid, request(tournament_format="GROUP_KNOCKOUT", group_count=2, advance_per_group=1,
                                             third_place=False), oid)  # 2 group games + 1 final
    venue = db.table("venues").insert({"name": "TEST__V", "address": "x", "created_by": owner_id}).execute().data[0]
    try:
        fields = [db.table("venue_fields").insert({"venue_id": venue["id"], "name": f"F{i}"}).execute().data[0] for i in range(2)]
        start = datetime.now(timezone.utc) + timedelta(days=1)
        for seq in (1, 2):
            slot = db.table("schedule_slots").insert({
                "event_id": event["id"], "sequence_number": seq,
                "scheduled_start": (start + timedelta(minutes=30 * seq)).isoformat(),
                "scheduled_end": (start + timedelta(minutes=30 * seq + 25)).isoformat()}).execute().data[0]
            for f in fields:  # two parallel fields per slot: the final must not sit beside its feeders
                db.table("slot_field_assignments").insert({"schedule_slot_id": slot["id"], "venue_field_id": f["id"]}).execute()
        db.table("events").update({"scheduling_state": "LIVE", "slot_structure_state": "FINALIZED"}).eq("id", event["id"]).execute()

        for _ in range(3):
            asyncio.run(scheduling_service.generate_next_slot(eid, ScheduleNextRequest(idempotency_key=uuid4()), oid))
        placed = db.table("matches").select("bracket_id, scheduled_start").eq("event_id", event["id"]).execute().data
        final = next(m for m in placed if m["bracket_id"])
        assert all(final["scheduled_start"] > m["scheduled_start"] for m in placed if not m["bracket_id"])
    finally:  # matches hold RESTRICT references to the fields, so the event goes first
        db.table("events").delete().eq("id", event["id"]).execute()
        db.table("venues").delete().eq("id", venue["id"]).execute()


def test_unassign_frees_the_slot_and_refuses_started_matches(event, owner_id):
    from app.schemas.scheduling import ScheduleUnassignRequest

    add_teams(event["id"], owner_id, 3)
    eid, oid = UUID(event["id"]), UUID(owner_id)
    tournament_service.generate(eid, request(tournament_format="ROUND_ROBIN"), oid)
    venue = db.table("venues").insert({"name": "TEST__V", "address": "x", "created_by": owner_id}).execute().data[0]
    try:
        field = db.table("venue_fields").insert({"venue_id": venue["id"], "name": "F"}).execute().data[0]
        start = datetime.now(timezone.utc) + timedelta(days=1)
        for seq in (1, 2, 3):
            slot = db.table("schedule_slots").insert({
                "event_id": event["id"], "sequence_number": seq,
                "scheduled_start": (start + timedelta(minutes=30 * seq)).isoformat(),
                "scheduled_end": (start + timedelta(minutes=30 * seq + 25)).isoformat()}).execute().data[0]
            db.table("slot_field_assignments").insert({"schedule_slot_id": slot["id"], "venue_field_id": field["id"]}).execute()
        db.table("events").update({"scheduling_state": "LIVE", "slot_structure_state": "FINALIZED"}).eq("id", event["id"]).execute()
        for _ in range(3):
            asyncio.run(scheduling_service.generate_next_slot(eid, ScheduleNextRequest(idempotency_key=uuid4()), oid))

        first, second = [r["fixture_id"] for r in db.table("slot_field_assignments").select("fixture_id, schedule_slots!inner(sequence_number)")
                         .eq("schedule_slots.event_id", event["id"]).order("schedule_slots(sequence_number)").execute().data][:2]
        asyncio.run(scheduling_service.unassign_fixture(eid, ScheduleUnassignRequest(fixture_id=first)))
        assert db.table("matches").select("scheduling_status").eq("id", first).execute().data[0]["scheduling_status"] == "UNASSIGNED"
        assert db.table("schedule_slots").select("status").eq("event_id", event["id"]).eq("sequence_number", 1).execute().data[0]["status"] == "EMPTY"

        db.table("matches").update({"match_state": "LIVE"}).eq("id", second).execute()
        with pytest.raises(HTTPException):
            asyncio.run(scheduling_service.unassign_fixture(eid, ScheduleUnassignRequest(fixture_id=second)))
    finally:
        db.table("events").delete().eq("id", event["id"]).execute()
        db.table("venues").delete().eq("id", venue["id"]).execute()


def test_standings_list_every_team_and_ignore_knockout_games(event, owner_id, test_client):
    teams = add_teams(event["id"], owner_id, 4)
    idx = {t["id"]: i for i, t in enumerate(teams)}
    eid, oid = UUID(event["id"]), UUID(owner_id)
    url = f"/api/v1/statistics/standings/{event['id']}"
    tournament_service.generate(eid, request(tournament_format="GROUP_KNOCKOUT", group_count=2, advance_per_group=1, third_place=False), oid)

    before = test_client.get(url).json()
    assert len(before) == 4 and all(r["matches_played"] == 0 and r["points"] == 0 for r in before)  # nobody has played, still listed
    assert {r["group_name"] for r in before} == {"Group A", "Group B"}

    matches = db.table("matches").select("*").eq("event_id", event["id"]).execute().data
    finish_by_seed(idx, [m for m in matches if m["group_id"]])
    tournament_service.advance_bracket(eid)
    final = next(m for m in matches if m["bracket_id"])
    final = db.table("matches").select("*").eq("id", final["id"]).execute().data[0]
    finish(final["id"], 5, 0)  # a knockout result must not leak into either group table

    rows = test_client.get(url).json()
    assert all(r["matches_played"] == 1 for r in rows)
    assert sorted(r["position"] for r in rows) == [1, 1, 2, 2]
    assert sum(r["goals_for"] for r in rows) == 2  # two group games at 1-0, the 5-0 final is excluded


def _groups_of(event_id):
    rows = db.table("event_team_registrations").select("team_name, group_id, groups(name)").eq("event_id", event_id).execute().data
    out = {}
    for r in rows:
        out.setdefault(r["groups"]["name"], set()).add(r["team_name"])
    return out


def test_seeded_draw_splits_groups_in_snake_order(event, owner_id):
    teams = add_teams(event["id"], owner_id, 8)
    for seed, t in enumerate(reversed(teams), start=1):  # Team 7 is the strongest
        db.table("event_team_registrations").update({"seed": seed}).eq("id", t["id"]).execute()
    tournament_service.generate(UUID(event["id"]), request(tournament_format="GROUP_KNOCKOUT", group_count=2, advance_per_group=2, draw="SEEDED"), UUID(owner_id))
    groups = _groups_of(event["id"])
    # seeds 1,4,5,8 vs 2,3,6,7  ->  Team 7,4,3,0 vs Team 6,5,2,1
    assert groups == {"Group A": {"Team 7", "Team 4", "Team 3", "Team 0"}, "Group B": {"Team 6", "Team 5", "Team 2", "Team 1"}}


def test_random_draw_still_builds_a_valid_tournament_and_differs_between_runs(event, owner_id):
    add_teams(event["id"], owner_id, 8)
    seen = set()
    for _ in range(6):
        res = tournament_service.generate(UUID(event["id"]), request(tournament_format="GROUP_KNOCKOUT", group_count=2, advance_per_group=2, draw="RANDOM"), UUID(owner_id))
        assert res["fixture_count"] == 16 and "random draw" in res["message"]
        groups = _groups_of(event["id"])
        assert sorted(len(g) for g in groups.values()) == [4, 4]
        seen.add(frozenset(frozenset(g) for g in groups.values()))
        tournament_service.reset(UUID(event["id"]), UUID(owner_id))
    assert len(seen) > 1  # six shuffles of eight teams all landing the same way has odds of about 1 in 35^5


def test_a_team_is_never_booked_on_two_pitches_in_the_same_slot(event, owner_id):
    teams = add_teams(event["id"], owner_id, 4)
    eid, oid = UUID(event["id"]), UUID(owner_id)
    a, b, c, d = (t["id"] for t in teams)
    base = datetime.now(timezone.utc)
    # created order puts the clashing fixture (a v c) straight after (a v b)
    for i, (h, w) in enumerate([(a, b), (a, c), (c, d)]):
        db.table("matches").insert({"event_id": event["id"], "home_registration_id": h, "away_registration_id": w, "status": "SCHEDULED",
                                    "scheduling_status": "UNASSIGNED", "created_at": (base + timedelta(milliseconds=i)).isoformat()}).execute()
    venue = db.table("venues").insert({"name": "TEST__V", "address": "x", "created_by": owner_id}).execute().data[0]
    try:
        fields = [db.table("venue_fields").insert({"venue_id": venue["id"], "name": f"F{i}"}).execute().data[0] for i in range(2)]
        start = datetime.now(timezone.utc) + timedelta(days=1)
        for seq in (1, 2):
            slot = db.table("schedule_slots").insert({"event_id": event["id"], "sequence_number": seq,
                "scheduled_start": (start + timedelta(minutes=30 * seq)).isoformat(), "scheduled_end": (start + timedelta(minutes=30 * seq + 25)).isoformat()}).execute().data[0]
            for f in fields:
                db.table("slot_field_assignments").insert({"schedule_slot_id": slot["id"], "venue_field_id": f["id"]}).execute()
        db.table("events").update({"scheduling_state": "LIVE", "slot_structure_state": "FINALIZED"}).eq("id", event["id"]).execute()
        for _ in range(3):
            asyncio.run(scheduling_service.generate_next_slot(eid, ScheduleNextRequest(idempotency_key=uuid4()), oid))
        rows = db.table("matches").select("home_registration_id, away_registration_id, scheduled_start").eq("event_id", event["id"]).execute().data
        by_start = {}
        for m in rows:
            by_start.setdefault(m["scheduled_start"], []).append({m["home_registration_id"], m["away_registration_id"]})
        for games in by_start.values():
            assert len(set().union(*games)) == 2 * len(games)  # no team appears twice in one slot
    finally:
        db.table("events").delete().eq("id", event["id"]).execute()
        db.table("venues").delete().eq("id", venue["id"]).execute()
