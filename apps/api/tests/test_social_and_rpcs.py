"""Friends, DMs, blocking, notifications and the RPCs the web app calls, as a signed-in client sees them."""
import os
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError
from supabase import create_client

from app.core.supabase_client import supabase_admin as admin


def make_user(tag):
    email, password = f"{tag}_{uuid4().hex[:8]}@example.com", "TestPassword123!"
    user = admin.auth.admin.create_user({"email": email, "password": password, "email_confirm": True}).user
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"])
    sb.auth.sign_in_with_password({"email": email, "password": password})
    return user.id, sb


@pytest.fixture
def trio():
    people = [make_user(t) for t in ("soc_a", "soc_b", "soc_c")]
    yield people
    for uid, _ in people:
        admin.auth.admin.delete_user(uid)


def notifications(uid, kind):
    return [n for n in admin.table("notifications").select("type").eq("user_id", uid).execute().data if n["type"] == kind]


def befriend(a, b):
    a[1].rpc("send_friend_request", {"target_user_id": b[0]}).execute()
    b[1].table("friendships").update({"status": "ACCEPTED"}).eq("requester_id", a[0]).eq("addressee_id", b[0]).execute()


def test_unique_code_search_finds_a_player(trio):
    (a, sa), (b, sb), _ = trio
    code = admin.table("users").select("unique_code").eq("id", b).execute().data[0]["unique_code"]
    found = sa.rpc("search_user_by_unique_code", {"search_code": code}).execute().data
    assert found
    assert (found[0]["id"] if isinstance(found, list) else found["id"]) == b


def test_friend_request_flow_notifies_both_sides(trio):
    a, b, c = trio
    a[1].rpc("send_friend_request", {"target_user_id": b[0]}).execute()
    assert len(notifications(b[0], "FRIEND_REQUEST")) == 1
    first = admin.table("friendships").select("id").eq("requester_id", a[0]).execute().data
    again = b[1].rpc("send_friend_request", {"target_user_id": a[0]}).execute().data  # reverse request while pending: no second row
    assert again == first[0]["id"] and len(admin.table("friendships").select("id").execute().data) >= 1
    assert len(admin.table("friendships").select("id").or_(f"requester_id.eq.{a[0]},addressee_id.eq.{a[0]}").execute().data) == 1
    b[1].table("friendships").update({"status": "ACCEPTED"}).eq("requester_id", a[0]).execute()
    assert len(notifications(a[0], "FRIEND_ACCEPTED")) == 1
    assert c[1].table("friendships").select("id").execute().data == []  # a stranger sees none of it


def test_direct_messages_need_friendship_and_stay_private(trio):
    a, b, c = trio
    admin.table("user_privacy_settings").update({"dm_permission": "FRIENDS"}).eq("user_id", b[0]).execute()
    with pytest.raises(APIError):
        a[1].rpc("get_or_create_direct_conversation", {"target_user_id": b[0]}).execute()  # b only takes DMs from friends
    admin.table("user_privacy_settings").update({"dm_permission": "NONE"}).eq("user_id", c[0]).execute()
    with pytest.raises(APIError):
        a[1].rpc("get_or_create_direct_conversation", {"target_user_id": c[0]}).execute()  # c takes none
    befriend(a, b)
    conv = a[1].rpc("get_or_create_direct_conversation", {"target_user_id": b[0]}).execute().data
    assert b[1].rpc("get_or_create_direct_conversation", {"target_user_id": a[0]}).execute().data == conv  # one thread per pair

    a[1].table("messages").insert({"conversation_id": conv, "sender_id": a[0], "body": "hello"}).execute()
    assert [m["body"] for m in b[1].table("messages").select("body").eq("conversation_id", conv).execute().data] == ["hello"]
    assert c[1].table("messages").select("id").eq("conversation_id", conv).execute().data == []  # outsiders read nothing
    with pytest.raises(APIError):  # and cannot write into someone else's thread
        c[1].table("messages").insert({"conversation_id": conv, "sender_id": c[0], "body": "intrude"}).execute()
    with pytest.raises(APIError):  # nobody can send as somebody else
        b[1].table("messages").insert({"conversation_id": conv, "sender_id": a[0], "body": "spoof"}).execute()
    assert len(notifications(b[0], "DM_RECEIVED")) == 1


def test_blocking_ends_the_friendship_and_the_conversation_channel(trio):
    a, b, _ = trio
    befriend(a, b)
    conv = a[1].rpc("get_or_create_direct_conversation", {"target_user_id": b[0]}).execute().data
    b[1].table("blocks").insert({"blocker_id": b[0], "blocked_id": a[0]}).execute()
    assert admin.table("friendships").select("status").eq("requester_id", a[0]).execute().data in ([], [{"status": "BLOCKED"}])
    with pytest.raises(APIError):
        a[1].table("messages").insert({"conversation_id": conv, "sender_id": a[0], "body": "still there?"}).execute()


def test_referee_invites_by_code_and_player_names(trio):
    owner, ref, rando = trio
    ev = admin.table("events").insert({"name": f"TEST__SOC__{uuid4().hex[:6]}", "description": "x", "organizer_id": owner[0], "status": "LIVE"}).execute().data[0]
    try:
        admin.table("event_roles").insert({"event_id": ev["id"], "user_id": owner[0], "role": "EVENT_OWNER"}).execute()
        code = admin.table("users").select("unique_code").eq("id", ref[0]).execute().data[0]["unique_code"]
        with pytest.raises(APIError):  # only event admins may invite
            rando[1].rpc("invite_event_referee", {"p_event_id": ev["id"], "p_unique_code": code}).execute()
        owner[1].rpc("invite_event_referee", {"p_event_id": ev["id"], "p_unique_code": code}).execute()
        assert admin.table("event_roles").select("role").eq("event_id", ev["id"]).eq("user_id", ref[0]).execute().data == [{"role": "REFEREE"}]

        reg = admin.table("event_team_registrations").insert({"event_id": ev["id"], "team_name": "T", "status": "APPROVED", "captain_id": owner[0]}).execute().data[0]
        admin.table("event_team_players").insert([{"event_registration_id": reg["id"], "guest_name": "Guest G", "status": "APPROVED"},
                                                  {"event_registration_id": reg["id"], "user_id": rando[0], "status": "APPROVED"}]).execute()
        names = {r["display_name"] for r in rando[1].rpc("get_event_player_names", {"p_event_id": ev["id"]}).execute().data}
        assert "Guest G" in names and len(names) == 2  # a stranger can read names through the RPC despite user-row RLS

        opponent = admin.table("event_team_registrations").insert({"event_id": ev["id"], "team_name": "U", "status": "APPROVED", "captain_id": owner[0]}).execute().data[0]
        match = admin.table("matches").insert({"event_id": ev["id"], "home_registration_id": reg["id"], "away_registration_id": opponent["id"]}).execute().data[0]
        owner[1].rpc("invite_match_referee", {"p_match_id": match["id"], "p_unique_code": code}).execute()
        assert admin.table("match_referees").select("user_id").eq("match_id", match["id"]).execute().data[0]["user_id"] == ref[0]
        with pytest.raises(APIError):
            rando[1].rpc("invite_match_referee", {"p_match_id": match["id"], "p_unique_code": code}).execute()
    finally:
        admin.table("events").delete().eq("id", ev["id"]).execute()
