import pytest
import os
import uuid
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://lcxgjwdffkexrrnfcuik.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

@pytest.fixture(scope="module")
def setup_test_data():
    org_res = supabase.auth.admin.create_user({"email": f"org_{uuid.uuid4()}@test.com", "password": "password", "email_confirm": True})
    org_id = org_res.user.id
    
    ref_res = supabase.auth.admin.create_user({"email": f"ref_{uuid.uuid4()}@test.com", "password": "password", "email_confirm": True})
    ref_id = ref_res.user.id
    
    event_id = str(uuid.uuid4())
    supabase.table("events").insert({
        "id": event_id, "name": "Phase 4 Test Event", "description": "Test", "organizer_id": org_id, "status": "LIVE"
    }).execute()
    
    supabase.table("event_roles").insert({"event_id": event_id, "user_id": org_id, "role": "EVENT_ADMIN"}).execute()
    supabase.table("event_roles").insert({"event_id": event_id, "user_id": ref_id, "role": "REFEREE"}).execute()
    
    team_a_reg = str(uuid.uuid4())
    team_b_reg = str(uuid.uuid4())
    
    supabase.table("event_team_registrations").insert([
        {"id": team_a_reg, "event_id": event_id, "team_name": "Team A", "captain_id": org_id, "status": "APPROVED"},
        {"id": team_b_reg, "event_id": event_id, "team_name": "Team B", "captain_id": org_id, "status": "APPROVED"}
    ]).execute()
    
    p1 = str(uuid.uuid4())
    p2 = str(uuid.uuid4())
    
    supabase.table("event_team_players").insert([
        {"id": p1, "event_registration_id": team_a_reg, "user_id": org_id},
        {"id": p2, "event_registration_id": team_b_reg, "user_id": ref_id}
    ]).execute()
    
    match_id = str(uuid.uuid4())
    # Note: match_state might not be recognized yet by PostgREST cache but we'll try without inserting it explicitly if it defaults to SCHEDULED
    supabase.table("matches").insert({
        "id": match_id, "event_id": event_id, "home_registration_id": team_a_reg, "away_registration_id": team_b_reg
    }).execute()
    
    yield {
        "org_id": org_id,
        "ref_id": ref_id,
        "event_id": event_id,
        "match_id": match_id,
        "team_a_reg": team_a_reg,
        "team_b_reg": team_b_reg,
        "p1": p1,
        "p2": p2
    }
    
    # Cleanup
    supabase.table("matches").delete().eq("id", match_id).execute()
    supabase.table("event_team_registrations").delete().in_("id", [team_a_reg, team_b_reg]).execute()
    supabase.table("events").delete().eq("id", event_id).execute()
    supabase.auth.admin.delete_user(org_id)
    supabase.auth.admin.delete_user(ref_id)

def test_acceptance_flow(setup_test_data):
    data = setup_test_data
    match_id = data["match_id"]
    event_id = data["event_id"]
    ref_id = data["ref_id"]
    org_id = data["org_id"]
    
    from app.services.match_engine_service import MatchEngineService
    from app.schemas.match_operations import (
        StateTransitionRequest, MatchState, RefereeEventRequest, 
        RefereeEventType, MatchPeriod, TimelineEventRequest, TimelineEventType
    )
    
    service = MatchEngineService(supabase)
    
    supabase.table("match_referees").insert({
        "match_id": match_id, "user_id": ref_id, "status": "ACCEPTED", "assigned_by": org_id
    }).execute()
    
    # 1.5 Add lineups
    l1 = str(uuid.uuid4())
    l2 = str(uuid.uuid4())
    supabase.table("match_lineups").insert([
        {"id": l1, "match_id": match_id, "team_registration_id": data["team_a_reg"], "status": "CONFIRMED", "submitted_by": org_id, "confirmed_by": ref_id, "version": 1},
        {"id": l2, "match_id": match_id, "team_registration_id": data["team_b_reg"], "status": "CONFIRMED", "submitted_by": org_id, "confirmed_by": ref_id, "version": 1}
    ]).execute()
    supabase.table("match_lineup_players").insert([
        {"lineup_id": l1, "event_team_player_id": data["p1"], "status": "STARTER"},
        {"lineup_id": l2, "event_team_player_id": data["p2"], "status": "STARTER"}
    ]).execute()
    
    # 2. State transitions
    service.transition_state(uuid.UUID(match_id), uuid.UUID(ref_id), StateTransitionRequest(
        idempotency_key=uuid.uuid4(), new_state=MatchState.READY
    ))
    service.transition_state(uuid.UUID(match_id), uuid.UUID(ref_id), StateTransitionRequest(
        idempotency_key=uuid.uuid4(), new_state=MatchState.LIVE
    ))
    
    # 3. Referee records a YELLOW CARD
    foul_id = uuid.uuid4()
    service.record_referee_event(uuid.UUID(match_id), uuid.UUID(ref_id), RefereeEventRequest(
        id=foul_id, event_type=RefereeEventType.FOUL, period=MatchPeriod.FIRST_HALF,
        elapsed_seconds=120, display_minute=2, display_second=0,
        event_player_id=uuid.UUID(data["p1"]), event_registration_id=uuid.UUID(data["team_a_reg"]),
        metadata={"foul_type": "TRIPPING"}
    ))
    
    card_id = uuid.uuid4()
    service.record_referee_event(uuid.UUID(match_id), uuid.UUID(ref_id), RefereeEventRequest(
        id=card_id, event_type=RefereeEventType.YELLOW_CARD, period=MatchPeriod.FIRST_HALF,
        elapsed_seconds=121, display_minute=2, display_second=1,
        event_player_id=uuid.UUID(data["p1"]), event_registration_id=uuid.UUID(data["team_a_reg"]),
        metadata={"reason": "FOUL_PLAY"}
    ))
    
    # 4. Recorder records PASS -> SHOT -> GOAL
    pass_id = uuid.uuid4()
    service.record_timeline_event(uuid.UUID(match_id), uuid.UUID(org_id), TimelineEventRequest(
        id=pass_id, event_type=TimelineEventType.PASS, period=MatchPeriod.FIRST_HALF,
        elapsed_seconds=180, display_minute=3, display_second=0,
        actor_player_id=uuid.UUID(data["p1"]), actor_registration_id=uuid.UUID(data["team_a_reg"]),
        target_player_id=uuid.UUID(data["p2"]), target_registration_id=uuid.UUID(data["team_b_reg"]),
        metadata={"assist": True}
    ))
    
    shot_id = uuid.uuid4()
    service.record_timeline_event(uuid.UUID(match_id), uuid.UUID(org_id), TimelineEventRequest(
        id=shot_id, event_type=TimelineEventType.SHOT, period=MatchPeriod.FIRST_HALF,
        elapsed_seconds=185, display_minute=3, display_second=5,
        actor_player_id=uuid.UUID(data["p2"]), actor_registration_id=uuid.UUID(data["team_b_reg"]),
        x=85.0, y=50.0,
        metadata={"result": "GOAL", "goal_type": "STANDARD"}
    ))
    
    # 5. Transition to completed
    service.transition_state(uuid.UUID(match_id), uuid.UUID(ref_id), StateTransitionRequest(
        idempotency_key=uuid.uuid4(), new_state=MatchState.COMPLETED
    ))
    
    # 6. Verify separation and statistics
    tl_events = supabase.table("match_timeline_events").select("id").eq("match_id", match_id).execute().data
    ref_events = supabase.table("referee_events").select("id").eq("match_id", match_id).execute().data
    
    assert len(tl_events) == 2, "Only Pass and Shot should be in timeline"
    assert len(ref_events) == 2, "Only Foul and Yellow should be in referee events"
    
    # Calculate Rating manually via RPC equivalent
    res = supabase.rpc("calculate_player_rating", {"p_match_id": match_id, "p_player_id": data["p2"]}).execute()
    assert float(res.data) == 7.5
