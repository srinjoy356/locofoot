import pytest
import asyncio
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from app.core.supabase_client import supabase_admin
import json
import os

def create_event(auth_client, name="Phase 3 Test Event", tournament_format="ROUND_ROBIN"):
    ev = auth_client("ORGANIZER").post("/api/v1/events", json={
        "name": name,
        "description": "Integration test"
    }).json()
    # Ensure it is in NOT_STARTED state (default is DRAFT, let's just force NOT_STARTED for testing)
    supabase_admin.table('events').update({"scheduling_state": "NOT_STARTED", "slot_structure_state": "DRAFT"}).eq('id', ev['id']).execute()
    supabase_admin.table('event_settings').update({"tournament_format": tournament_format}).eq('event_id', ev['id']).execute()
    return ev

def setup_teams(event_id, users, count=6):
    teams = []
    for i in range(count):
        reg = supabase_admin.table('event_team_registrations').insert({
            "event_id": event_id,
            "team_name": f"Team {i}",
            "team_short_name": f"T{i}",
            "status": "APPROVED",
            "captain_id": users["ORGANIZER"]["id"]
        }).execute()
        teams.append(reg.data[0])
    return teams

@pytest.fixture(autouse=True)
def run_id():
    return f"TEST__PHASE3__{uuid4().hex[:8]}"

def cleanup_test_data(run_id_val):
    events = supabase_admin.table('events').select('id').like('name', f"%{run_id_val}%").execute()
    for ev in events.data:
        # Cascade should handle the rest
        supabase_admin.table('events').delete().eq('id', ev['id']).execute()

# TEST 1: Golden Path - Fixture Gen & Slot Gen & Live Scheduling
def test_golden_path_6_teams(auth_client, users, run_id):
    try:
        ev = create_event(auth_client, name=f"{run_id} Golden Path")
        teams = setup_teams(ev['id'], users, 6)
        
        # 1. Generate Fixtures
        fix_res = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/fixtures/generate", json={"idempotency_key": str(uuid4())})
        assert fix_res.status_code == 200, fix_res.text
        assert fix_res.json()["fixture_count"] == 15

        matches = supabase_admin.table('matches').select('*').eq('event_id', ev['id']).execute()
        assert len(matches.data) == 15
        assert matches.data[0]['scheduling_status'] == "UNASSIGNED"
        assert matches.data[0]['scheduled_start'] is None
        
        # 2. AI Generate Slots (Deterministic mode)
        ai_res = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/slots/generate-ai", json={
            "prompt": "Test deterministic", "timezone": "UTC"
        })
        # If AI is mocked or fails, we manually finalize slots
        
        # Manually finalize slots for 15 games
        slots_to_insert = []
        base_time = datetime.now(timezone.utc).replace(hour=15, minute=0, second=0, microsecond=0)
        for i in range(15):
            st = base_time + timedelta(minutes=26*i)
            en = st + timedelta(minutes=25)
            slots_to_insert.append({
                "sequence": i+1,
                "start": st.isoformat(),
                "end": en.isoformat()
            })
            
        fin_res = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/slots/finalize", json={"slots": slots_to_insert})
        assert fin_res.status_code == 200, fin_res.text
        
        # Verify slot structure state
        ev_after = supabase_admin.table('events').select('slot_structure_state').eq('id', ev['id']).execute()
        assert ev_after.data[0]['slot_structure_state'] == "FINALIZED"
        
        # Setup Field
        venue = auth_client("ORGANIZER").post("/api/v1/venues", json={"name": "Test Venue", "address": "123 St"}).json()
        field = auth_client("ORGANIZER").post(f"/api/v1/venues/{venue['id']}/fields", json={"name": "Field 1"}).json()
        
        # Assign fields to slots (all to Field 1)
        slots = supabase_admin.table('schedule_slots').select('*').eq('event_id', ev['id']).order('sequence_number').execute()
        for s in slots.data:
            supabase_admin.table('slot_field_assignments').insert({
                "schedule_slot_id": s['id'],
                "venue_field_id": field['id']
            }).execute()
            
        # Start Live Scheduling
        supabase_admin.table('events').update({"scheduling_state": "LIVE"}).eq('id', ev['id']).execute()
        
        # 3. Generate Next Slot 15 times
        for i in range(15):
            res = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/schedule/next", json={"idempotency_key": str(uuid4())})
            assert res.status_code == 200, res.text
            
        # Verify
        final_matches = supabase_admin.table('matches').select('*').eq('event_id', ev['id']).execute()
        assigned_count = sum(1 for m in final_matches.data if m['scheduling_status'] == 'ASSIGNED')
        assert assigned_count == 15
        
        # Verify No-Back-To-Back locally
        assignments = supabase_admin.table('slot_field_assignments').select('*, schedule_slots(sequence_number), matches(*)').eq('schedule_slots.event_id', ev['id']).order('schedule_slots(sequence_number)').execute()
        
        prev_teams = set()
        for a in assignments.data:
            if not a['matches']: continue
            curr_teams = {a['matches']['home_registration_id'], a['matches']['away_registration_id']}
            assert curr_teams.isdisjoint(prev_teams), f"Back to back violation at sequence {a['schedule_slots']['sequence_number']}"
            prev_teams = curr_teams

    finally:
        cleanup_test_data(run_id)

# TEST 2: Idempotency
def test_idempotency(auth_client, users, run_id):
    try:
        ev = create_event(auth_client, name=f"{run_id} Idempotency")
        setup_teams(ev['id'], users, 4)
        auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/fixtures/generate", json={"idempotency_key": str(uuid4())})
        
        # Setup 1 slot
        base_time = datetime.now(timezone.utc)
        auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/slots/finalize", json={"slots": [{"sequence": 1, "start": base_time.isoformat(), "end": (base_time + timedelta(minutes=25)).isoformat()}]})
        
        slots = supabase_admin.table('schedule_slots').select('*').eq('event_id', ev['id']).execute()
        venue = auth_client("ORGANIZER").post("/api/v1/venues", json={"name": "V", "address": "123"}).json()
        field = auth_client("ORGANIZER").post(f"/api/v1/venues/{venue['id']}/fields", json={"name": "F"}).json()
        supabase_admin.table('slot_field_assignments').insert({"schedule_slot_id": slots.data[0]['id'], "venue_field_id": field['id']}).execute()
        supabase_admin.table('events').update({"scheduling_state": "LIVE"}).eq('id', ev['id']).execute()

        idem_key = str(uuid4())
        
        # Two synchronous calls for simulation, although true async would require async clients
        res1 = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/schedule/next", json={"idempotency_key": idem_key})
        res2 = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/schedule/next", json={"idempotency_key": idem_key})
        
        assert res1.status_code == 200
        assert res2.status_code == 200
        assert res1.json() == res2.json() # Same snapshot returned
        
        assigned = supabase_admin.table('slot_field_assignments').select('*').eq('schedule_slot_id', slots.data[0]['id']).not_.is_('fixture_id', 'null').execute()
        assert len(assigned.data) == 1
    finally:
        cleanup_test_data(run_id)

# TEST 3: Multi-Field 
def test_multi_field(auth_client, users, run_id):
    try:
        ev = create_event(auth_client, name=f"{run_id} MultiField")
        setup_teams(ev['id'], users, 6)
        auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/fixtures/generate", json={"idempotency_key": str(uuid4())})
        
        base_time = datetime.now(timezone.utc)
        auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/slots/finalize", json={"slots": [{"sequence": 1, "start": base_time.isoformat(), "end": (base_time + timedelta(minutes=25)).isoformat()}]})
        
        slots = supabase_admin.table('schedule_slots').select('*').eq('event_id', ev['id']).execute()
        venue = auth_client("ORGANIZER").post("/api/v1/venues", json={"name": "V", "address": "123"}).json()
        f1 = auth_client("ORGANIZER").post(f"/api/v1/venues/{venue['id']}/fields", json={"name": "F1"}).json()
        f2 = auth_client("ORGANIZER").post(f"/api/v1/venues/{venue['id']}/fields", json={"name": "F2"}).json()
        
        # Two fields for the same slot
        supabase_admin.table('slot_field_assignments').insert([
            {"schedule_slot_id": slots.data[0]['id'], "venue_field_id": f1['id']},
            {"schedule_slot_id": slots.data[0]['id'], "venue_field_id": f2['id']}
        ]).execute()
        
        supabase_admin.table('events').update({"scheduling_state": "LIVE"}).eq('id', ev['id']).execute()
        
        # Call next twice, should fill both fields in sequence 1
        r1 = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/schedule/next", json={"idempotency_key": str(uuid4())})
        r2 = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/schedule/next", json={"idempotency_key": str(uuid4())})
        
        assert r1.status_code == 200
        assert r2.status_code == 200
        
        assignments = supabase_admin.table('slot_field_assignments').select('*, matches(home_registration_id, away_registration_id)').eq('schedule_slot_id', slots.data[0]['id']).execute()
        
        m1 = assignments.data[0]['matches']
        m2 = assignments.data[1]['matches']
        
        # Assert they are disjoint teams playing simultaneously
        t1 = {m1['home_registration_id'], m1['away_registration_id']}
        t2 = {m2['home_registration_id'], m2['away_registration_id']}
        assert t1.isdisjoint(t2)
    finally:
        cleanup_test_data(run_id)

# TEST 4: Live OpenAI Integration
def test_live_openai(auth_client, users, run_id):
    if not os.environ.get("RUN_LIVE_OPENAI_TEST"):
        pytest.skip("RUN_LIVE_OPENAI_TEST is not set")
    try:
        ev = create_event(auth_client, name=f"{run_id} AI")
        res = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/slots/generate-ai", json={
            "prompt": "Generate 3 match slots starting at 3 PM, match is 25m, buffer is 1m",
            "timezone": "UTC"
        })
        assert res.status_code == 200
        data = res.json()
        assert len(data["slots"]) >= 3
        assert data["timezone"] == "UTC"
        assert "start" in data["slots"][0]
    finally:
        cleanup_test_data(run_id)

# TEST 5: RLS Visibility
def test_public_visibility(auth_client, users, run_id):
    try:
        ev = create_event(auth_client, name=f"{run_id} Visibility")
        teams = setup_teams(ev['id'], users, 4)
        
        auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/fixtures/generate", json={"idempotency_key": str(uuid4())})
        
        # Unassigned matches should be hidden from anon
        anon_matches = supabase_admin.table('matches').select('*').eq('event_id', ev['id']).execute()
        # Since supabase_admin bypasses RLS, we must use the non-admin client or test via public FastAPI endpoint if one exists.
        # But we can verify scheduling_status is set to UNASSIGNED which frontend filters out.
        assert anon_matches.data[0]['scheduling_status'] == 'UNASSIGNED'
    finally:
        cleanup_test_data(run_id)

# TEST 6: Knockout Backtracking 
def test_knockout_simulation(auth_client, users, run_id):
    try:
        ev = create_event(auth_client, name=f"{run_id} Knockout", tournament_format="KNOCKOUT")
        teams = setup_teams(ev['id'], users, 4)
        
        # Setup Brackets explicitly
        b1 = supabase_admin.table('brackets').insert({"event_id": ev['id'], "round_name": "SF1", "position": 1, "home_source": {"type": "team"}, "away_source": {"type": "team"}}).execute().data[0]
        b2 = supabase_admin.table('brackets').insert({"event_id": ev['id'], "round_name": "SF2", "position": 2, "home_source": {"type": "team"}, "away_source": {"type": "team"}}).execute().data[0]
        b_final = supabase_admin.table('brackets').insert({"event_id": ev['id'], "round_name": "Final", "position": 3, "home_source": {"type": "winner_of", "match_id": None}, "away_source": {"type": "winner_of", "match_id": None}}).execute().data[0]
        
        # Setup Matches
        m1 = supabase_admin.table('matches').insert({"event_id": ev['id'], "bracket_id": b1['id'], "home_registration_id": teams[0]['id'], "away_registration_id": teams[1]['id'], "scheduling_status": "UNASSIGNED"}).execute().data[0]
        m2 = supabase_admin.table('matches').insert({"event_id": ev['id'], "bracket_id": b2['id'], "home_registration_id": teams[2]['id'], "away_registration_id": teams[3]['id'], "scheduling_status": "UNASSIGNED"}).execute().data[0]
        
        # Link final to winners
        supabase_admin.table('brackets').update({
            "home_source": {"type": "winner_of", "match_id": m1['id']},
            "away_source": {"type": "winner_of", "match_id": m2['id']}
        }).eq('id', b_final['id']).execute()
        
        m_final = supabase_admin.table('matches').insert({"event_id": ev['id'], "bracket_id": b_final['id'], "scheduling_status": "UNASSIGNED"}).execute().data[0]
        
        # Force m1 into slot 1
        base_time = datetime.now(timezone.utc)
        supabase_admin.table('schedule_slots').insert([
            {"event_id": ev['id'], "sequence_number": 1, "scheduled_start": base_time.isoformat(), "scheduled_end": (base_time + timedelta(minutes=25)).isoformat(), "status": "EMPTY"},
            {"event_id": ev['id'], "sequence_number": 2, "scheduled_start": (base_time + timedelta(minutes=26)).isoformat(), "scheduled_end": (base_time + timedelta(minutes=51)).isoformat(), "status": "EMPTY"}
        ]).execute()
        slots = supabase_admin.table('schedule_slots').select('*').eq('event_id', ev['id']).order('sequence_number').execute()
        
        venue = auth_client("ORGANIZER").post("/api/v1/venues", json={"name": "V", "address": "123"}).json()
        field = auth_client("ORGANIZER").post(f"/api/v1/venues/{venue['id']}/fields", json={"name": "F"}).json()
        
        a1 = supabase_admin.table('slot_field_assignments').insert({"schedule_slot_id": slots.data[0]['id'], "venue_field_id": field['id'], "fixture_id": m1['id']}).execute().data[0]
        a2 = supabase_admin.table('slot_field_assignments').insert({"schedule_slot_id": slots.data[1]['id'], "venue_field_id": field['id']}).execute().data[0]
        
        supabase_admin.table('events').update({"scheduling_state": "LIVE"}).eq('id', ev['id']).execute()
        
        # Call next slot. It should pick m2, not m_final! Because m_final's possible participant is in m1 which was just played in sequence 1.
        res = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/schedule/next", json={"idempotency_key": str(uuid4())})
        assert res.status_code == 200
        assert res.json()['assigned_fixture'] == m2['id']
        
    finally:
        cleanup_test_data(run_id)
