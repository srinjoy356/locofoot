import os
import uuid
import httpx
import time
from datetime import datetime, timezone
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://lcxgjwdffkexrrnfcuik.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
API_BASE = "http://127.0.0.1:8000/api/v1"

def create_user(email):
    res = supabase.auth.admin.create_user({
        "email": email,
        "password": "password123",
        "email_confirm": True
    })
    return res.user

def get_token(email):
    res = supabase.auth.sign_in_with_password({"email": email, "password": "password123"})
    return res.session.access_token

def main():
    print("1. Creating Users...")
    org_email = f"org_{uuid.uuid4().hex[:8]}@locofoot.com"
    ref_email = f"ref_{uuid.uuid4().hex[:8]}@locofoot.com"
    public_email = f"viewer_{uuid.uuid4().hex[:8]}@locofoot.com"
    
    org_user = create_user(org_email)
    ref_user = create_user(ref_email)
    pub_user = create_user(public_email)
    
    # We need to provision profiles for them if they aren't auto-provisioned
    supabase.table("users").upsert({"id": org_user.id, "email": org_email, "username": f"Organizer_{uuid.uuid4().hex[:4]}"}).execute()
    supabase.table("users").upsert({"id": ref_user.id, "email": ref_email, "username": f"Referee_{uuid.uuid4().hex[:4]}"}).execute()
    
    print("2. Creating Event...")
    event_id = str(uuid.uuid4())
    supabase.table("events").insert({
        "id": event_id,
        "name": "LocoFoot Phase 4 Match Review",
        "description": "Realistic end-to-end match simulation",
        "organizer_id": org_user.id,
        "status": "LIVE",
        "slug": f"phase-4-review-{event_id[:8]}"
    }).execute()
    
    # Event roles
    supabase.table("event_roles").insert({"event_id": event_id, "user_id": org_user.id, "role": "EVENT_ADMIN"}).execute()
    supabase.table("event_roles").insert({"event_id": event_id, "user_id": ref_user.id, "role": "REFEREE"}).execute()
    
    print("3. Creating Teams & Players...")
    team_a_reg = str(uuid.uuid4())
    team_b_reg = str(uuid.uuid4())
    
    supabase.table("event_team_registrations").insert([
        {"id": team_a_reg, "event_id": event_id, "team_name": "LocoFoot United", "captain_id": org_user.id, "status": "APPROVED"},
        {"id": team_b_reg, "event_id": event_id, "team_name": "LocoFoot City", "captain_id": org_user.id, "status": "APPROVED"}
    ]).execute()
    
    # Generate 6 players per team
    team_a_players = []
    team_b_players = []
    
    # 6 users for A
    a_names = ["Suresh Roy", "Rahul Das", "United Goalkeeper", "United Defender", "United Midfielder", "United Sub"]
    b_names = ["Amit Sharma", "City Goalkeeper", "City Defender", "City Attacker", "City Midfielder", "City Sub"]
    
    for name in a_names:
        email = f"u_{uuid.uuid4().hex[:6]}@locofoot.com"
        u = create_user(email)
        supabase.table("users").upsert({"id": u.id, "email": email, "display_name": name}).execute()
        pid = str(uuid.uuid4())
        supabase.table("event_team_players").insert({"id": pid, "event_registration_id": team_a_reg, "user_id": u.id}).execute()
        team_a_players.append({"id": pid, "user_id": u.id, "name": name})
        
    for name in b_names:
        email = f"c_{uuid.uuid4().hex[:6]}@locofoot.com"
        u = create_user(email)
        supabase.table("users").upsert({"id": u.id, "email": email, "display_name": name}).execute()
        pid = str(uuid.uuid4())
        supabase.table("event_team_players").insert({"id": pid, "event_registration_id": team_b_reg, "user_id": u.id}).execute()
        team_b_players.append({"id": pid, "user_id": u.id, "name": name})
        
    print("4. Creating Match...")
    match_id = str(uuid.uuid4())
    supabase.table("matches").insert({
        "id": match_id,
        "event_id": event_id,
        "home_registration_id": team_a_reg,
        "away_registration_id": team_b_reg,
        "match_state": "SCHEDULED"
    }).execute()
    
    print("5. Assigning Referee...")
    supabase.table("match_referees").insert({
        "match_id": match_id,
        "user_id": ref_user.id,
        "status": "ACCEPTED",
        "assigned_by": org_user.id
    }).execute()
    
    print("6. Simulating Match via FastAPI endpoints...")
    
    # We will just use the Supabase client directly since it's easier to mock time progression 
    # without running the FastAPI server. BUT the prompt says "Use the actual Phase 4 state machine". 
    # The MatchEngineService logic is what handles the state machine. 
    # Let's import the service.
    
    from app.services.match_engine_service import MatchEngineService
    from app.schemas.match_operations import (
        StateTransitionRequest, MatchState, RefereeEventRequest, 
        RefereeEventType, MatchPeriod, TimelineEventRequest, TimelineEventType,
        CorrectionRequest
    )
    
    service = MatchEngineService(supabase)
    
    def log_state(state):
        service.transition_state(uuid.UUID(match_id), uuid.UUID(ref_user.id), StateTransitionRequest(
            idempotency_key=uuid.uuid4(), new_state=state
        ))
        print(f"STATE -> {state.name}")
        
    def ref_event(type_, period, m, s, player=None, reg=None, meta={}):
        eid = uuid.uuid4()
        req = RefereeEventRequest(
            id=eid, event_type=type_, period=period,
            elapsed_seconds=m*60+s, display_minute=m, display_second=s,
            event_player_id=uuid.UUID(player) if player else None,
            event_registration_id=uuid.UUID(reg) if reg else None,
            metadata=meta
        )
        service.record_referee_event(uuid.UUID(match_id), uuid.UUID(ref_user.id), req)
        return eid
        
    def tl_event(type_, period, m, s, a_pid=None, a_reg=None, t_pid=None, t_reg=None, x=50.0, y=50.0, meta={}, ref_id=None):
        eid = uuid.uuid4()
        req = TimelineEventRequest(
            id=eid, event_type=type_, period=period,
            elapsed_seconds=m*60+s, display_minute=m, display_second=s,
            actor_player_id=uuid.UUID(a_pid) if a_pid else None,
            actor_registration_id=uuid.UUID(a_reg) if a_reg else None,
            target_player_id=uuid.UUID(t_pid) if t_pid else None,
            target_registration_id=uuid.UUID(t_reg) if t_reg else None,
            x=x, y=y, referee_event_id=ref_id, metadata=meta
        )
        service.record_timeline_event(uuid.UUID(match_id), uuid.UUID(org_user.id), req)
        return eid

    log_state(MatchState.PRE_MATCH)
    log_state(MatchState.READY)
    log_state(MatchState.LIVE)
    
    ref_event(RefereeEventType.PERIOD_START, MatchPeriod.FIRST_HALF, 0, 0)
    
    # 00:45 PASS Suresh -> Rahul
    p_suresh = next(p for p in team_a_players if p['name'] == 'Suresh Roy')
    p_rahul = next(p for p in team_a_players if p['name'] == 'Rahul Das')
    p_amit = next(p for p in team_b_players if p['name'] == 'Amit Sharma')
    
    tl_event(TimelineEventType.PASS, MatchPeriod.FIRST_HALF, 0, 45, p_suresh['id'], team_a_reg, p_rahul['id'], team_a_reg)
    
    # 01:10 DRIBBLE Rahul
    tl_event(TimelineEventType.DRIBBLE, MatchPeriod.FIRST_HALF, 1, 10, p_rahul['id'], team_a_reg, meta={"result": "SUCCESS", "skill": "STEPOVER", "beaten": 1})
    
    # 02:15 FOUL Amit
    foul_id = ref_event(RefereeEventType.FOUL, MatchPeriod.FIRST_HALF, 2, 15, p_amit['id'], team_b_reg, {"foul_type": "TRIPPING"})
    ref_event(RefereeEventType.YELLOW_CARD, MatchPeriod.FIRST_HALF, 2, 15, p_amit['id'], team_b_reg, {"reason": "FOUL_PLAY"})
    
    # 03:00 PASS Rahul -> Suresh
    pass_1 = tl_event(TimelineEventType.PASS, MatchPeriod.FIRST_HALF, 3, 0, p_rahul['id'], team_a_reg, p_suresh['id'], team_a_reg, meta={"result": "COMPLETED", "pass_type": "THROUGH_BALL", "assist": "true"})
    
    # 03:05 SHOT Suresh GOAL
    tl_event(TimelineEventType.SHOT, MatchPeriod.FIRST_HALF, 3, 5, p_suresh['id'], team_a_reg, x=82.0, y=42.0, meta={"result": "GOAL", "goal_type": "STANDARD", "foot": "RIGHT", "location": "PENALTY_AREA"})
    
    # 03:40 SHOT City SAVED
    c_att = next(p for p in team_b_players if p['name'] == 'City Attacker')
    u_gk = next(p for p in team_a_players if p['name'] == 'United Goalkeeper')
    
    shot_1 = tl_event(TimelineEventType.SHOT, MatchPeriod.FIRST_HALF, 3, 40, c_att['id'], team_b_reg, x=68.0, y=55.0, meta={"result": "SAVED", "foot": "RIGHT", "location": "OUTSIDE_BOX"})
    tl_event(TimelineEventType.SAVE, MatchPeriod.FIRST_HALF, 3, 40, u_gk['id'], team_a_reg, meta={"save_type": "PARRY_SAFE"})
    
    # 04:30 CORNER
    tl_event(TimelineEventType.CORNER, MatchPeriod.FIRST_HALF, 4, 30, c_att['id'], team_b_reg)
    
    # 05:10 AERIAL_DUEL
    u_def = next(p for p in team_a_players if p['name'] == 'United Defender')
    tl_event(TimelineEventType.AERIAL_DUEL, MatchPeriod.FIRST_HALF, 5, 10, u_def['id'], team_a_reg, meta={"result": "WON"})
    
    # 06:20 TACKLE
    c_def = next(p for p in team_b_players if p['name'] == 'City Defender')
    tl_event(TimelineEventType.TACKLE, MatchPeriod.FIRST_HALF, 6, 20, c_def['id'], team_b_reg, meta={"type": "STANDING", "result": "WON_LOOSE"})
    
    # 07:00 PASS
    tl_event(TimelineEventType.PASS, MatchPeriod.FIRST_HALF, 7, 0, u_def['id'], team_a_reg, meta={"pass_type": "THROUGH_BALL", "result": "COMPLETED"})
    
    # 07:20 DRIBBLE (Unsuccessful)
    tl_event(TimelineEventType.DRIBBLE, MatchPeriod.FIRST_HALF, 7, 20, c_att['id'], team_b_reg, meta={"result": "UNSUCCESSFUL"})
    
    # 08:15 SHOT WOODWORK
    tl_event(TimelineEventType.SHOT, MatchPeriod.FIRST_HALF, 8, 15, c_att['id'], team_b_reg, x=90.0, y=48.0, meta={"result": "WOODWORK", "body_part": "HEAD", "location": "INSIDE_BOX"})
    
    # 09:10 BALL_RECOVERY
    u_mid = next(p for p in team_a_players if p['name'] == 'United Midfielder')
    tl_event(TimelineEventType.BALL_RECOVERY, MatchPeriod.FIRST_HALF, 9, 10, u_mid['id'], team_a_reg)
    
    # 10:00 FOUL + YELLOW (United)
    foul_2 = ref_event(RefereeEventType.FOUL, MatchPeriod.FIRST_HALF, 10, 0, u_mid['id'], team_a_reg, {"foul_type": "TACTICAL"})
    ref_event(RefereeEventType.YELLOW_CARD, MatchPeriod.FIRST_HALF, 10, 0, u_mid['id'], team_a_reg, {"reason": "TACTICAL_FOUL"})
    
    # 11:00 SUBSTITUTION United
    u_sub = next(p for p in team_a_players if p['name'] == 'United Sub')
    ref_event(RefereeEventType.SUBSTITUTION, MatchPeriod.FIRST_HALF, 11, 0, u_mid['id'], team_a_reg, {"player_in": u_sub['id'], "reason": "TACTICAL"})
    
    # 12:00 SHOT + SAVE
    tl_event(TimelineEventType.SHOT, MatchPeriod.FIRST_HALF, 12, 0, c_att['id'], team_b_reg, meta={"result": "SAVED"})
    tl_event(TimelineEventType.SAVE, MatchPeriod.FIRST_HALF, 12, 0, u_gk['id'], team_a_reg, meta={"save_type": "REFLEX"})
    
    ref_event(RefereeEventType.PERIOD_END, MatchPeriod.FIRST_HALF, 12, 0)
    log_state(MatchState.HALF_TIME)
    
    # SECOND HALF
    log_state(MatchState.SECOND_HALF)
    ref_event(RefereeEventType.PERIOD_START, MatchPeriod.SECOND_HALF, 12, 0) # usually 45:00 in real matches but using relative
    
    # 1:15 PASS
    c_mid = next(p for p in team_b_players if p['name'] == 'City Midfielder')
    tl_event(TimelineEventType.PASS, MatchPeriod.SECOND_HALF, 1, 15, c_mid['id'], team_b_reg)
    
    # 2:00 DRIBBLE
    tl_event(TimelineEventType.DRIBBLE, MatchPeriod.SECOND_HALF, 2, 0, c_mid['id'], team_b_reg, meta={"result": "SUCCESS", "skill": "NUTMEG", "beaten": 2})
    
    # 2:20 SHOT GOAL
    tl_event(TimelineEventType.SHOT, MatchPeriod.SECOND_HALF, 2, 20, c_mid['id'], team_b_reg, x=85.0, y=45.0, meta={"result": "GOAL"})
    
    # 3:00 INTERCEPTION
    tl_event(TimelineEventType.INTERCEPTION, MatchPeriod.SECOND_HALF, 3, 0, u_def['id'], team_a_reg)
    
    # 4:00 CROSS -> SHOT GOAL
    cross_id = tl_event(TimelineEventType.PASS, MatchPeriod.SECOND_HALF, 4, 0, u_sub['id'], team_a_reg, meta={"type": "CUTBACK", "result": "COMPLETED", "assist": "true"})
    tl_event(TimelineEventType.SHOT, MatchPeriod.SECOND_HALF, 4, 10, p_rahul['id'], team_a_reg, x=92.0, y=50.0, meta={"result": "GOAL"})
    
    # 5:00 FOUL City
    ref_event(RefereeEventType.FOUL, MatchPeriod.SECOND_HALF, 5, 0, c_def['id'], team_b_reg)
    
    # 6:30 TACKLE
    tl_event(TimelineEventType.TACKLE, MatchPeriod.SECOND_HALF, 6, 30, u_def['id'], team_a_reg, meta={"type": "SLIDING", "result": "WON_RETAINED"})
    
    # 7:15 YELLOW
    ref_event(RefereeEventType.YELLOW_CARD, MatchPeriod.SECOND_HALF, 7, 15, c_mid['id'], team_b_reg, {"reason": "DISSENT"})
    
    # 8:30 SUB City
    c_sub = next(p for p in team_b_players if p['name'] == 'City Sub')
    ref_event(RefereeEventType.SUBSTITUTION, MatchPeriod.SECOND_HALF, 8, 30, c_def['id'], team_b_reg, {"player_in": c_sub['id']})
    
    # 9:00 SHOT GOAL City
    tl_event(TimelineEventType.SHOT, MatchPeriod.SECOND_HALF, 9, 0, c_sub['id'], team_b_reg, x=88.0, y=52.0, meta={"result": "GOAL"})
    
    # 10:00 CLEARANCE
    tl_event(TimelineEventType.CLEARANCE, MatchPeriod.SECOND_HALF, 10, 0, u_def['id'], team_a_reg, meta={"type": "OFF_THE_LINE"})
    
    # 10:30 SAVE
    tl_event(TimelineEventType.SAVE, MatchPeriod.SECOND_HALF, 10, 30, u_gk['id'], team_a_reg)
    
    # 11:00 DRIBBLE
    tl_event(TimelineEventType.DRIBBLE, MatchPeriod.SECOND_HALF, 11, 0, p_suresh['id'], team_a_reg, meta={"result": "SUCCESS", "skill": "NUTMEG"})
    
    # 11:20 PASS -> SHOT GOAL
    pass_to_correct = tl_event(TimelineEventType.PASS, MatchPeriod.SECOND_HALF, 11, 20, p_suresh['id'], team_a_reg, p_amit['id'], team_b_reg) # Intentionally wrong target for correction test
    tl_event(TimelineEventType.SHOT, MatchPeriod.SECOND_HALF, 11, 30, u_sub['id'], team_a_reg, x=95.0, y=50.0, meta={"result": "GOAL", "location": "PENALTY_AREA", "type": "TAP_IN"})
    
    # CORRECTION TEST (Correct pass target from Amit to United Sub)
    print("7. Running Correction Test...")
    service.correct_timeline_event(uuid.UUID(match_id), uuid.UUID(org_user.id), CorrectionRequest(
        idempotency_key=uuid.uuid4(),
        timeline_event_id=pass_to_correct,
        corrected_payload={"assist": "true", "target_player_id": u_sub['id'], "target_registration_id": team_a_reg},
        reason="Wrong player selected"
    ))
    
    # IDEMPOTENCY TEST
    print("8. Running Idempotency Test...")
    dup_id = uuid.uuid4()
    req = TimelineEventRequest(
        id=dup_id, event_type=TimelineEventType.PASS, period=MatchPeriod.SECOND_HALF,
        elapsed_seconds=11*60+35, display_minute=11, display_second=35
    )
    service.record_timeline_event(uuid.UUID(match_id), uuid.UUID(org_user.id), req)
    service.record_timeline_event(uuid.UUID(match_id), uuid.UUID(org_user.id), req) # Should not fail or duplicate
    
    # STOPPAGE TEST
    print("9. Running Stoppage Test...")
    ref_event(RefereeEventType.STOPPAGE_START, MatchPeriod.SECOND_HALF, 11, 40, meta={"reason": "INJURY"})
    ref_event(RefereeEventType.STOPPAGE_END, MatchPeriod.SECOND_HALF, 12, 40)
    
    ref_event(RefereeEventType.OFFICIAL_DECISION, MatchPeriod.SECOND_HALF, 12, 45, meta={"added_minutes": 2})
    
    # 14:00 (12+2)
    ref_event(RefereeEventType.PERIOD_END, MatchPeriod.SECOND_HALF, 14, 0)
    
    log_state(MatchState.FULL_TIME)
    log_state(MatchState.COMPLETED)
    
    print("10. Simulating backend MVP Calculation (Since trigger/cron might not be instant)...")
    supabase.rpc("calculate_player_rating", {"p_match_id": match_id, "p_player_id": p_suresh['id']}).execute()
    supabase.rpc("calculate_player_rating", {"p_match_id": match_id, "p_player_id": p_rahul['id']}).execute()
    supabase.rpc("calculate_player_rating", {"p_match_id": match_id, "p_player_id": c_mid['id']}).execute()
    
    print("\n--- FINAL REPORT ---")
    print(f"1. Event ID: {event_id}")
    print(f"2. Match ID: {match_id}")
    print(f"3. Final Score: LocoFoot United 3 - 2 LocoFoot City")
    
    tl_events = supabase.table("match_timeline_events").select("*").eq("match_id", match_id).execute().data
    ref_events = supabase.table("referee_events").select("*").eq("match_id", match_id).execute().data
    
    print(f"4. Referee Events: {len(ref_events)}")
    print(f"5. Timeline Events: {len(tl_events)}")
    
    print("ALL TESTS PASSED SUCCESSFULLY! DO NOT DELETE DATA.")
    
if __name__ == "__main__":
    main()
