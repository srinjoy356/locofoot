"""Row/column level security as seen by a signed-in client (PostgREST with a user JWT)."""
import os
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError
from supabase import create_client

from app.core.supabase_client import supabase_admin as admin


@pytest.fixture
def client():
    url, anon = os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    email, password = f"rls_{uuid4().hex[:8]}@example.com", "TestPassword123!"
    user = admin.auth.admin.create_user({"email": email, "password": password, "email_confirm": True}).user
    sb = create_client(url, anon)
    sb.auth.sign_in_with_password({"email": email, "password": password})
    yield sb, user.id
    admin.auth.admin.delete_user(user.id)


def test_user_cannot_promote_or_unban_themselves(client):
    sb, uid = client
    for column, value in (("platform_role", "SUPER_ADMIN"), ("account_status", "ACTIVE"), ("email_verified", True)):
        with pytest.raises(APIError):
            sb.table("users").update({column: value}).eq("id", uid).execute()
    row = admin.table("users").select("platform_role").eq("id", uid).execute().data[0]
    assert row["platform_role"] == "USER"


def test_user_can_still_edit_their_profile(client):
    sb, uid = client
    sb.table("users").update({"bio": "hello", "display_name": "Tester"}).eq("id", uid).execute()
    assert admin.table("users").select("bio, display_name").eq("id", uid).execute().data[0] == {"bio": "hello", "display_name": "Tester"}


def test_owner_reads_own_draft_event_but_a_stranger_does_not(client):
    # regression: 0067 left the policy comparing event_roles.event_id with event_roles.id, hiding every DRAFT event from its owner
    sb, uid = client
    ev = admin.table("events").insert({"name": f"TEST__DRAFT__{uuid4().hex[:6]}", "description": "d", "organizer_id": uid, "status": "DRAFT", "public_token": str(uuid4())}).execute().data[0]
    try:
        admin.table("event_roles").upsert({"event_id": ev["id"], "user_id": uid, "role": "EVENT_OWNER"}).execute()
        admin.table("event_settings").upsert({"event_id": ev["id"]}).execute()
        assert len(sb.table("events").select("id").eq("id", ev["id"]).execute().data) == 1
        assert len(sb.table("event_settings").select("event_id").eq("event_id", ev["id"]).execute().data) == 1
        admin.table("event_roles").delete().eq("event_id", ev["id"]).eq("user_id", uid).execute()
        assert sb.table("events").select("id").eq("id", ev["id"]).execute().data == []
    finally:
        admin.table("events").delete().eq("id", ev["id"]).execute()


def test_clients_cannot_forge_match_data(client):
    sb, uid = client
    forged = {"id": str(uuid4()), "match_id": str(uuid4()), "event_type": "SHOT", "period": "FIRST_HALF",
              "elapsed_seconds": 1, "display_minute": 0, "display_second": 1}
    with pytest.raises(APIError):
        sb.table("match_timeline_events").insert(forged).execute()
    with pytest.raises(APIError):
        sb.table("match_player_ratings").insert({"match_id": str(uuid4())}).execute()


def test_profile_visibility_works_for_officials_teammates_and_strangers(client):
    # regression: is_user_visible() referenced a missing column, so any profile outside the first few rules returned a 400
    sb, uid = client
    def make(tag):
        return admin.auth.admin.create_user({"email": f"vis_{tag}_{uuid4().hex[:6]}@example.com", "password": "TestPassword123!", "email_confirm": True}).user.id
    scorer, player, stranger = make("scorer"), make("player"), make("stranger")
    ev = admin.table("events").insert({"name": f"TEST__VIS__{uuid4().hex[:6]}", "description": "v", "organizer_id": uid, "status": "LIVE", "public_token": str(uuid4())}).execute().data[0]
    try:
        admin.table("event_roles").insert([{"event_id": ev["id"], "user_id": uid, "role": "EVENT_OWNER"}, {"event_id": ev["id"], "user_id": scorer, "role": "SCORER"}]).execute()
        reg = admin.table("event_team_registrations").insert({"event_id": ev["id"], "team_name": "Vis FC", "status": "APPROVED", "captain_id": uid}).execute().data[0]
        admin.table("event_team_players").insert({"event_registration_id": reg["id"], "user_id": player, "status": "APPROVED"}).execute()
        seen = {r["id"] for r in sb.table("users").select("id").in_("id", [scorer, player, stranger]).execute().data}
        assert seen == {scorer, player}  # the official and the teammate are visible; the stranger is not; nothing errors
        # the recorder (a scorer) must be able to read the names of the players whose match they record
        scorer_client = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"])
        scorer_client.auth.sign_in_with_password({"email": admin.auth.admin.get_user_by_id(scorer).user.email, "password": "TestPassword123!"})
        assert [r["id"] for r in scorer_client.table("users").select("id").eq("id", player).execute().data] == [player]
    finally:
        admin.table("events").delete().eq("id", ev["id"]).execute()
        for u in (scorer, player, stranger):
            admin.auth.admin.delete_user(u)
