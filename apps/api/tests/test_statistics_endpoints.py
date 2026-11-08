"""Every public statistics endpoint must answer for a normal tournament, including guest players (no account, no unique code)."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.supabase_client import supabase_admin as db


@pytest.fixture
def played(auth_client, users):
    org = auth_client("ORGANIZER")
    ev = org.post("/api/v1/events", json={"name": f"TEST__STATS__{uuid4().hex[:8]}", "description": "stats"}).json()
    eid = ev["id"]
    db.table("events").update({"status": "LIVE"}).eq("id", eid).execute()
    base = datetime.now(timezone.utc)
    teams = []
    for i, captain in enumerate(("CAPTAIN", "SECOND_CAPTAIN")):
        reg = db.table("event_team_registrations").insert({"event_id": eid, "team_name": f"S{i}", "status": "APPROVED", "captain_id": users[captain]["id"],
                                                           "registered_at": (base + timedelta(seconds=i)).isoformat()}).execute().data[0]
        pl = db.table("event_team_players").insert([{"event_registration_id": reg["id"], "guest_name": f"G{i}{j}", "jersey_number": j + 1, "status": "APPROVED"} for j in range(7)]).execute().data
        teams.append({"reg": reg["id"], "players": [p["id"] for p in pl]})
    m = db.table("matches").insert({"event_id": eid, "home_registration_id": teams[0]["reg"], "away_registration_id": teams[1]["reg"], "scheduling_status": "ASSIGNED"}).execute().data[0]
    base_url = f"/api/v1/events/{eid}/matches/{m['id']}"
    for t in teams:
        assert org.post(f"{base_url}/lineups/submit", json={"team_registration_id": t["reg"], "players": [
            {"event_team_player_id": p, "lineup_role": "STARTER" if k < 6 else "SUBSTITUTE"} for k, p in enumerate(t["players"])]}).status_code == 200
        assert org.post(f"{base_url}/lineups/confirm", params={"team_registration_id": t["reg"]}).status_code == 200
    for s in ("READY", "LIVE"):
        assert org.post(f"{base_url}/referee/state", json={"idempotency_key": str(uuid4()), "new_state": s}).status_code == 200
    n = [0]

    def ev_(kind, **kw):
        n[0] += 7
        body = {"id": str(uuid4()), "period": "FIRST_HALF", "elapsed_seconds": n[0], "display_minute": n[0] // 60, "display_second": n[0] % 60, **kw}
        assert org.post(f"{base_url}/{kind}/event", json=body).status_code == 200

    h, a = teams
    ev_("timeline", event_type="PASS", actor_player_id=h["players"][0], actor_registration_id=h["reg"], target_player_id=h["players"][1], metadata={"result": "COMPLETED"})
    ev_("timeline", event_type="SHOT", actor_player_id=h["players"][1], actor_registration_id=h["reg"], assist_player_id=h["players"][0], x=50, y=10, metadata={"result": "GOAL"})
    ev_("timeline", event_type="SHOT", actor_player_id=a["players"][2], actor_registration_id=a["reg"], x=40, y=90, metadata={"result": "SAVED"})
    ev_("timeline", event_type="SAVE", actor_player_id=h["players"][0], actor_registration_id=h["reg"], metadata={})
    ev_("referee", event_type="YELLOW_CARD", event_player_id=a["players"][3], event_registration_id=a["reg"], metadata={"reason": "FOUL_PLAY"})
    for s in ("HALF_TIME", "SECOND_HALF", "FULL_TIME", "COMPLETED"):
        assert org.post(f"{base_url}/referee/state", json={"idempotency_key": str(uuid4()), "new_state": s}).status_code == 200
    yield {"event": eid, "match": m["id"], "reg": h["reg"], "player": h["players"][1]}
    db.table("events").delete().eq("id", eid).execute()


def test_every_statistics_endpoint_answers(played, test_client):
    e, m = played["event"], played["match"]
    paths = [
        f"standings/{e}", f"leaderboards/golden-boot?event_id={e}", f"leaderboards/playmaker?event_id={e}", f"tournament-players/{e}",
        f"players/{played['player']}", f"teams/{played['reg']}", f"tournament-kpis/{e}", f"team-form/{e}", f"player-form/{e}",
        f"match-statistics/{m}", f"match-player-performance/{m}", f"tournament-records/{e}/goals", f"tournament-records/{e}/cards",
        f"advanced/clutch/{e}", f"advanced/comebacks/{e}", f"advanced/records/{e}", f"advanced/trends/{e}",
        f"granular/shot-map/{e}", f"granular/playmaking/{e}", f"granular/goalkeeping/{e}",
    ]
    failures = {p: r.status_code for p in paths if (r := test_client.get(f"/api/v1/statistics/{p}")).status_code != 200}
    assert failures == {}

    players = test_client.get(f"/api/v1/statistics/tournament-players/{e}").json()
    scorer = next(p for p in players if p["event_player_id"] == played["player"])
    assert scorer["goals"] == 1 and scorer["player_unique_code"] == ""  # guests are listed, just without a code
    assert next(p for p in players if p["event_player_id"] != played["player"] and p["assists"] == 1)  # the assist on the goal counts

    goals = test_client.get(f"/api/v1/statistics/tournament-records/{e}/goals").json()
    cards = test_client.get(f"/api/v1/statistics/tournament-records/{e}/cards").json()
    assert [g["scorer"] for g in goals] == ["G01"] and goals[0]["assist"] == "G00"
    assert [c["card"] for c in cards] == ["YELLOW_CARD"] and cards[0]["player"] == "G13"
