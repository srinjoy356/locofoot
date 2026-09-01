import pytest
from app.core.supabase_client import supabase_admin
import json

# Test 1 - Event Creation
def test_event_creation(auth_client, users):
    res = auth_client("ORGANIZER").post("/api/v1/events", json={
        "name": "Integration Test Event",
        "description": "Integration test"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Integration Test Event"
    assert data["status"] == "DRAFT"
    
    # Check defaults
    settings = supabase_admin.table('event_settings').select('*').eq('event_id', data['id']).execute()
    assert len(settings.data) == 1
    
    stats = supabase_admin.table('event_stat_definitions').select('*').eq('event_id', data['id']).execute()
    assert len(stats.data) > 0
    
    roles = supabase_admin.table('event_roles').select('*').eq('event_id', data['id']).execute()
    assert roles.data[0]['user_id'] == users["ORGANIZER"]["id"]
    assert roles.data[0]['role'] == "EVENT_OWNER"

# Test 2 - Event Editing
def test_event_editing(auth_client, users):
    ev = auth_client("ORGANIZER").post("/api/v1/events", json={"name": "Edit Event", "description": ""}).json()
    
    res = auth_client("ORGANIZER").patch(f"/api/v1/events/{ev['id']}", json={
        "name": "Updated Name"
    })
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Name"

    # Settings update
    res2 = auth_client("ORGANIZER").put(f"/api/v1/events/{ev['id']}/settings", json={
        "max_squad": 15
    })
    assert res2.status_code == 200
    assert res2.json()["max_squad"] == 15

# Test 3 - Event Role Assignment
def test_event_roles(auth_client, users):
    ev = auth_client("ORGANIZER").post("/api/v1/events", json={"name": "Role Event", "description": ""}).json()
    
    res = auth_client("ORGANIZER").post(f"/api/v1/events/{ev['id']}/roles", json={
        "user_id": users["CAPTAIN"]["id"],
        "role": "EVENT_ADMIN"
    })
    assert res.status_code == 201
    
    roles = supabase_admin.table('event_roles').select('*').eq('event_id', ev['id']).execute()
    assert len(roles.data) == 2
    
    # Revoke
    role_id = res.json()["id"]
    rev = auth_client("ORGANIZER").delete(f"/api/v1/events/{ev['id']}/roles/{role_id}")
    assert rev.status_code == 200
    
    roles_after = supabase_admin.table('event_roles').select('*').eq('event_id', ev['id']).execute()
    assert len(roles_after.data) == 1

# Test 4 - Event Team Registration
def test_team_registration(auth_client, users):
    ev = auth_client("ORGANIZER").post("/api/v1/events", json={"name": "Reg Event", "description": ""}).json()
    
    # Needs to be REGISTRATION_OPEN
    auth_client("ORGANIZER").put(f"/api/v1/events/{ev['id']}/status", json={"status": "REGISTRATION_OPEN"})
    
    reg_res = auth_client("CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations", json={
        "team_name": "FC Test Team",
        "team_short_name": "FCT"
    })
    assert reg_res.status_code == 201, reg_res.text
    reg_id = reg_res.json()["id"]

    # Verify Captain auto-added
    players = supabase_admin.table('event_team_players').select('*').eq('event_registration_id', reg_id).execute()
    assert len(players.data) == 1
    assert players.data[0]['user_id'] == users["CAPTAIN"]["id"]
    assert players.data[0]['is_captain_for_event'] == True

# Test 5 - Event Squad Selection & Atomic Acceptance
def test_event_squad_invitation(auth_client, users):
    ev = auth_client("ORGANIZER").post("/api/v1/events", json={"name": "Squad Event", "description": ""}).json()
    auth_client("ORGANIZER").put(f"/api/v1/events/{ev['id']}/status", json={"status": "REGISTRATION_OPEN"})
    
    reg = auth_client("CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations", json={
        "team_name": "Invite Team"
    }).json()
    reg_id = reg["id"]
    
    # Invite eligible friend
    inv_res = auth_client("CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations/{reg_id}/invitations", json={
        "invited_user_id": users["PLAYER_FRIEND"]["id"]
    })
    assert inv_res.status_code == 201, inv_res.text
    inv_id = inv_res.json()["id"]
    
    # Try inviting non-friend
    inv_bad = auth_client("CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations/{reg_id}/invitations", json={
        "invited_user_id": users["PLAYER_NON_FRIEND"]["id"]
    })
    assert inv_bad.status_code == 403, inv_bad.text

    # Accept invitation
    acc_res = auth_client("PLAYER_FRIEND").patch(f"/api/v1/events/{ev['id']}/registrations/{reg_id}/invitations/{inv_id}/status", json={
        "status": "ACCEPTED"
    })
    assert acc_res.status_code == 200, acc_res.text

    # Verify roster
    players = supabase_admin.table('event_team_players').select('*').eq('event_registration_id', reg_id).execute()
    assert len(players.data) == 2  # Captain + Friend

# Test 6 - Single Team Per Event
def test_single_team_per_event(auth_client, users):
    ev = auth_client("ORGANIZER").post("/api/v1/events", json={"name": "Single Team Event", "description": ""}).json()
    auth_client("ORGANIZER").put(f"/api/v1/events/{ev['id']}/status", json={"status": "REGISTRATION_OPEN"})
    
    # Team 1
    reg1 = auth_client("CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations", json={"team_name": "Team 1"}).json()
    
    # Team 2
    reg2 = auth_client("SECOND_CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations", json={"team_name": "Team 2"}).json()

    # Invite friend to Team 1 and accept
    inv1 = auth_client("CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations/{reg1['id']}/invitations", json={
        "invited_user_id": users["PLAYER_FRIEND"]["id"]
    }).json()
    
    auth_client("PLAYER_FRIEND").patch(f"/api/v1/events/{ev['id']}/registrations/{reg1['id']}/invitations/{inv1['id']}/status", json={"status": "ACCEPTED"})

    # Make second captain friend with player
    supabase_admin.table('friendships').insert({
        "requester_id": users["SECOND_CAPTAIN"]["id"],
        "addressee_id": users["PLAYER_FRIEND"]["id"],
        "status": "ACCEPTED"
    }).execute()

    # Invite friend to Team 2
    inv2 = auth_client("SECOND_CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations/{reg2['id']}/invitations", json={
        "invited_user_id": users["PLAYER_FRIEND"]["id"]
    }).json()

    # Friend tries to accept second invite for same event
    acc2 = auth_client("PLAYER_FRIEND").patch(f"/api/v1/events/{ev['id']}/registrations/{reg2['id']}/invitations/{inv2['id']}/status", json={"status": "ACCEPTED"})
    assert acc2.status_code == 400
    assert "already registered" in acc2.text

# Test 7 - Organizer Approval
def test_organizer_approval(auth_client, users):
    ev = auth_client("ORGANIZER").post("/api/v1/events", json={"name": "Approval Event", "description": ""}).json()
    auth_client("ORGANIZER").put(f"/api/v1/events/{ev['id']}/status", json={"status": "REGISTRATION_OPEN"})
    
    supabase_admin.table('event_settings').update({'min_squad': 1}).eq('event_id', ev['id']).execute()

    reg = auth_client("CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations", json={"team_name": "Approval Team"}).json()
    
    # Submit registration
    sub_res = auth_client("CAPTAIN").post(f"/api/v1/events/{ev['id']}/registrations/{reg['id']}/submit")
    assert sub_res.status_code == 200, sub_res.text
    assert sub_res.json()["status"] == "PENDING_APPROVAL"

    # Organizer approves
    app_res = auth_client("ORGANIZER").put(f"/api/v1/events/{ev['id']}/registrations/{reg['id']}/status", json={"status": "APPROVED"})
    assert app_res.status_code == 200, app_res.text
    assert app_res.json()["status"] == "APPROVED"

# Test 8 - Venues
def test_venues(auth_client, users):
    org = auth_client("ORGANIZER")
    venue = org.post("/api/v1/venues", json={"name": "Test Venue", "address": "123 Test St"}).json()
    venue_id = venue["id"]
    
    field = org.post(f"/api/v1/venues/{venue_id}/fields", json={"name": "Field 1"}).json()
    field_id = field["id"]
    
    # Unauthorized edit
    bad_res = auth_client("UNAUTHORIZED_USER").patch(f"/api/v1/venues/{venue_id}/fields/{field_id}", json={"name": "Hacked"})
    assert bad_res.status_code == 403

# Test 9 - Audit Log check
def test_audit_logs():
    logs = supabase_admin.table('audit_logs').select('*').limit(1).execute()
    assert len(logs.data) > 0
    assert "action" in logs.data[0]
    assert "entity_type" in logs.data[0]
