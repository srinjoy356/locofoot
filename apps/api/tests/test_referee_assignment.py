"""Putting a referee on a match: they must hold the role, and cannot be on two matches that overlap in time."""
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError
from supabase import create_client

from app.core.supabase_client import supabase_admin as admin


@pytest.fixture
def setup():
    url, anon = os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    mk = lambda tag: admin.auth.admin.create_user({"email": f"ref_{tag}_{uuid4().hex[:6]}@example.com", "password": "TestPassword123!", "email_confirm": True}).user.id
    owner, ref, nobody = mk("owner"), mk("ref"), mk("nobody")
    sb = create_client(url, anon)
    sb.auth.sign_in_with_password({"email": admin.auth.admin.get_user_by_id(owner).user.email, "password": "TestPassword123!"})
    ev = admin.table("events").insert({"name": f"TEST__REF__{uuid4().hex[:6]}", "description": "r", "organizer_id": owner, "status": "LIVE", "public_token": str(uuid4())}).execute().data[0]
    admin.table("event_roles").insert([{"event_id": ev["id"], "user_id": owner, "role": "EVENT_OWNER"}, {"event_id": ev["id"], "user_id": ref, "role": "REFEREE"}]).execute()
    admin.table("event_settings").update({"first_half_minutes": 12, "half_time_minutes": 1, "second_half_minutes": 12}).eq("event_id", ev["id"]).execute()
    regs = [admin.table("event_team_registrations").insert({"event_id": ev["id"], "team_name": f"R{i}", "status": "APPROVED", "captain_id": owner}).execute().data[0]["id"] for i in range(4)]
    start = datetime.now(timezone.utc) + timedelta(days=1)

    def match(h, a, minutes):
        return admin.table("matches").insert({"event_id": ev["id"], "home_registration_id": regs[h], "away_registration_id": regs[a],
                                              "scheduled_start": (start + timedelta(minutes=minutes)).isoformat()}).execute().data[0]["id"]

    yield {"sb": sb, "ref_code": admin.table("users").select("unique_code").eq("id", ref).execute().data[0]["unique_code"],
           "nobody_code": admin.table("users").select("unique_code").eq("id", nobody).execute().data[0]["unique_code"], "match": match}
    admin.table("events").delete().eq("id", ev["id"]).execute()
    for u in (owner, ref, nobody):
        admin.auth.admin.delete_user(u)


def assign(sb, match_id, code):
    return sb.rpc("invite_match_referee", {"p_match_id": match_id, "p_unique_code": code}).execute()


def test_referee_cannot_be_on_two_overlapping_matches(setup):
    sb, code = setup["sb"], setup["ref_code"]
    first, same_time, later = setup["match"](0, 1, 0), setup["match"](2, 3, 0), setup["match"](0, 2, 120)
    assign(sb, first, code)
    with pytest.raises(APIError, match="same time"):
        assign(sb, same_time, code)
    assign(sb, later, code)  # 2 hours on is fine: a match lasts 25 minutes here


def test_only_people_with_the_referee_role_can_be_assigned(setup):
    with pytest.raises(APIError, match="not a referee"):
        assign(setup["sb"], setup["match"](0, 1, 0), setup["nobody_code"])
