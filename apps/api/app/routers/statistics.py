import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.supabase_client import get_async_service_supabase
from supabase import AsyncClient
from app.schemas.statistics import LeaderboardResponse, LeaderboardRow, TournamentStandingRow

router = APIRouter(prefix="/api/v1/statistics", tags=["Statistics"])

@router.get("/leaderboards/{metric}", response_model=LeaderboardResponse)
async def get_leaderboard(
    metric: str,
    scope: str = Query("event", description="Scope of the leaderboard (event, city, country, all-time)"),
    event_id: Optional[UUID] = None,
    limit: int = Query(20, le=100),
    cursor: int = Query(0, description="Offset cursor for pagination"),
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get a specific leaderboard metric.
    Metrics supported: golden-boot, playmaker, dribbles, etc.
    """
    # Let's call a flexible RPC we will define: get_leaderboard
    res = await supabase.rpc("get_leaderboard", {
        "p_metric": metric,
        "p_scope": scope,
        "p_event_id": str(event_id) if event_id else None,
        "p_limit": limit,
        "p_offset": cursor
    }).execute()
    
    player_ids = [r["event_player_id"] for r in res.data]
    unique_codes = {}
    if player_ids:
        # Join event_team_players with users to get unique_code
        etp_res = await supabase.table("event_team_players").select("id, user_id, users(unique_code)").in_("id", player_ids).execute()
        for etp in etp_res.data:
            users_data = etp.get("users")
            if users_data and isinstance(users_data, dict):
                unique_codes[etp["id"]] = users_data.get("unique_code")

    data = []
    for row in res.data:
        data.append(LeaderboardRow(
            event_player_id=row.get("event_player_id"),
            player_unique_code=unique_codes.get(row.get("event_player_id")),
            player_name=row.get("player_name", "Unknown"),
            team_name=row.get("team_name", "Unknown"),
            team_registration_id=row.get("team_registration_id"),
            matches_played=row.get("matches_played", 0),
            minutes_played=row.get("minutes_played", 0),
            value=row.get("value", 0)
        ))

    return LeaderboardResponse(
        metric=metric,
        scope=scope,
        filters={"event_id": str(event_id)} if event_id else {},
        threshold=None,
        data=data,
        next_cursor=cursor + limit if len(data) == limit else None,
        generated_at=datetime.datetime.utcnow().isoformat()
    )


@router.get("/standings/{event_id}", response_model=list[TournamentStandingRow])
async def get_tournament_standings(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get tournament standings.
    """
    # Fetch event settings for points
    event_res = await supabase.table("event_settings").select("*").eq("event_id", str(event_id)).execute()
    settings = event_res.data[0] if event_res.data else {}
    
    points_win = settings.get("points_win", 3)
    points_draw = settings.get("points_draw", 1)
    points_loss = settings.get("points_loss", 0)

    res = await supabase.table("tournament_standings_view").select("*").eq("event_id", str(event_id)).execute()
    
    if not res.data:
        return []

    team_ids = [r["team_id"] for r in res.data]
    teams_res = await supabase.table("event_team_registrations").select("id, team_name").in_("id", team_ids).execute()
    team_names = {t["id"]: t["team_name"] for t in teams_res.data}
    
    data = []
    for row in res.data:
        points = (row["wins"] * points_win) + (row["draws"] * points_draw) + (row["losses"] * points_loss)
        data.append(TournamentStandingRow(
            team_registration_id=row.get("team_id"),
            team_name=team_names.get(row.get("team_id"), "Unknown Team"),
            matches_played=row.get("matches_played", 0),
            wins=row.get("wins", 0),
            draws=row.get("draws", 0),
            losses=row.get("losses", 0),
            goals_for=row.get("goals_for", 0),
            goals_against=row.get("goals_against", 0),
            goal_difference=row.get("goal_difference", 0),
            points=points
        ))
        
    # Python-side sort based on tie-break rules, since points are dynamic
    data.sort(key=lambda x: (x.points, x.goal_difference, x.goals_for), reverse=True)
    return data

from app.schemas.statistics import PlayerStatsResponse, TeamStatsResponse
from pydantic import BaseModel

class TournamentPlayerStatsRow(BaseModel):
    event_player_id: UUID
    player_unique_code: str
    player_name: str
    team_registration_id: UUID
    team_name: str
    matches_played: int
    minutes_played: int
    goals: int
    penalty_goals: int
import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.supabase_client import get_async_service_supabase
from supabase import AsyncClient
from app.schemas.statistics import LeaderboardResponse, LeaderboardRow, TournamentStandingRow

router = APIRouter(prefix="/api/v1/statistics", tags=["Statistics"])

@router.get("/leaderboards/{metric}", response_model=LeaderboardResponse)
async def get_leaderboard(
    metric: str,
    scope: str = Query("event", description="Scope of the leaderboard (event, city, country, all-time)"),
    event_id: Optional[UUID] = None,
    limit: int = Query(20, le=100),
    cursor: int = Query(0, description="Offset cursor for pagination"),
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get a specific leaderboard metric.
    Metrics supported: golden-boot, playmaker, dribbles, etc.
    """
    # Let's call a flexible RPC we will define: get_leaderboard
    res = await supabase.rpc("get_leaderboard", {
        "p_metric": metric,
        "p_scope": scope,
        "p_event_id": str(event_id) if event_id else None,
        "p_limit": limit,
        "p_offset": cursor
    }).execute()
    
    player_ids = [r["event_player_id"] for r in res.data]
    unique_codes = {}
    if player_ids:
        # Join event_team_players with users to get unique_code
        etp_res = await supabase.table("event_team_players").select("id, user_id, users(unique_code)").in_("id", player_ids).execute()
        for etp in etp_res.data:
            users_data = etp.get("users")
            if users_data and isinstance(users_data, dict):
                unique_codes[etp["id"]] = users_data.get("unique_code")

    data = []
    for row in res.data:
        data.append(LeaderboardRow(
            event_player_id=row.get("event_player_id"),
            player_unique_code=unique_codes.get(row.get("event_player_id")),
            player_name=row.get("player_name", "Unknown"),
            team_name=row.get("team_name", "Unknown"),
            team_registration_id=row.get("team_registration_id"),
            matches_played=row.get("matches_played", 0),
            minutes_played=row.get("minutes_played", 0),
            value=row.get("value", 0)
        ))

    return LeaderboardResponse(
        metric=metric,
        scope=scope,
        filters={"event_id": str(event_id)} if event_id else {},
        threshold=None,
        data=data,
        next_cursor=cursor + limit if len(data) == limit else None,
        generated_at=datetime.datetime.utcnow().isoformat()
    )


@router.get("/standings/{event_id}", response_model=list[TournamentStandingRow])
async def get_tournament_standings(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get tournament standings.
    """
    # Fetch event settings for points
    event_res = await supabase.table("event_settings").select("*").eq("event_id", str(event_id)).execute()
    settings = event_res.data[0] if event_res.data else {}
    
    points_win = settings.get("points_win", 3)
    points_draw = settings.get("points_draw", 1)
    points_loss = settings.get("points_loss", 0)

    res = await supabase.table("tournament_standings_view").select("*").eq("event_id", str(event_id)).execute()
    
    if not res.data:
        return []

    team_ids = [r["team_id"] for r in res.data]
    teams_res = await supabase.table("event_team_registrations").select("id, team_name").in_("id", team_ids).execute()
    team_names = {t["id"]: t["team_name"] for t in teams_res.data}
    
    data = []
    for row in res.data:
        points = (row["wins"] * points_win) + (row["draws"] * points_draw) + (row["losses"] * points_loss)
        data.append(TournamentStandingRow(
            team_registration_id=row.get("team_id"),
            team_name=team_names.get(row.get("team_id"), "Unknown Team"),
            matches_played=row.get("matches_played", 0),
            wins=row.get("wins", 0),
            draws=row.get("draws", 0),
            losses=row.get("losses", 0),
            goals_for=row.get("goals_for", 0),
            goals_against=row.get("goals_against", 0),
            goal_difference=row.get("goal_difference", 0),
            points=points
        ))
        
    # Python-side sort based on tie-break rules, since points are dynamic
    data.sort(key=lambda x: (x.points, x.goal_difference, x.goals_for), reverse=True)
    return data

from app.schemas.statistics import PlayerStatsResponse, TeamStatsResponse
from pydantic import BaseModel

class TournamentPlayerStatsRow(BaseModel):
    event_player_id: UUID
    player_unique_code: str
    player_name: str
    team_registration_id: UUID
    team_name: str
    matches_played: int
    minutes_played: int
    goals: int
    penalty_goals: int
    assists: int
    goal_contributions: int
    shots: int
    shots_on_target: int
    passes_attempted: int
    passes_completed: int
    key_passes: int
    through_balls: int
    crosses: int
    big_chances_created: int
    dribbles_attempted: int
    successful_dribbles: int
    ankle_breakers: int
    nutmegs: int
    tackles_attempted: int
    tackles: int
    interceptions: int
    recoveries: int
    clearances: int
    blocks: int
    aerials_won: int
    saves: int
    penalty_saves: int
    saves_1v1: int
    aerial_claims: int
    sweeper_actions: int
    fouls_committed: int
    fouls_drawn: int
    yellow_cards: int
    red_cards: int
    average_rating: Optional[float] = None

@router.get("/tournament-players/{event_id}", response_model=list[TournamentPlayerStatsRow])
async def get_tournament_players_statistics(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get aggregated statistics for all players in a tournament.
    """
    res = await supabase.table("tournament_player_stats_view").select("*").eq("event_id", str(event_id)).execute()
    
    data = []
    for r in res.data:
        data.append(TournamentPlayerStatsRow(
            event_player_id=r["event_player_id"],
            player_unique_code=r.get("player_unique_code", ""),
            player_name=r.get("player_name", "Unknown"),
            team_registration_id=r["team_registration_id"],
            team_name=r.get("team_name", "Unknown"),
            matches_played=r.get("matches_played", 0),
            minutes_played=r.get("minutes_played") or 0,
            goals=r.get("goals") or 0,
            penalty_goals=r.get("penalty_goals") or 0,
            assists=r.get("assists") or 0,
            goal_contributions=r.get("goal_contributions") or 0,
            shots=r.get("shots") or 0,
            shots_on_target=r.get("shots_on_target") or 0,
            passes_attempted=r.get("passes_attempted") or 0,
            passes_completed=r.get("passes_completed") or 0,
            key_passes=r.get("key_passes") or 0,
            through_balls=r.get("through_balls") or 0,
            crosses=r.get("crosses") or 0,
            big_chances_created=r.get("big_chances_created") or 0,
            dribbles_attempted=r.get("dribbles_attempted") or 0,
            successful_dribbles=r.get("successful_dribbles") or 0,
            ankle_breakers=r.get("ankle_breakers") or 0,
            nutmegs=r.get("nutmegs") or 0,
            tackles_attempted=r.get("tackles_attempted") or 0,
            tackles=r.get("tackles") or 0,
            interceptions=r.get("interceptions") or 0,
            recoveries=r.get("recoveries") or 0,
            clearances=r.get("clearances") or 0,
            blocks=r.get("blocks") or 0,
            aerials_won=r.get("aerials_won") or 0,
            saves=r.get("saves") or 0,
            penalty_saves=r.get("penalty_saves") or 0,
            saves_1v1=r.get("saves_1v1") or 0,
            aerial_claims=r.get("aerial_claims") or 0,
            sweeper_actions=r.get("sweeper_actions") or 0,
            fouls_committed=r.get("fouls_committed") or 0,
            fouls_drawn=r.get("fouls_drawn") or 0,
            yellow_cards=r.get("yellow_cards") or 0,
            red_cards=r.get("red_cards") or 0,
            average_rating=r.get("average_rating")
        ))
        
    return data

@router.get("/players/{event_player_id}")
async def get_player_statistics(
    event_player_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get aggregated statistics for a specific player across the event.
    """
    res = await supabase.table("tournament_player_stats_view").select("*").eq("event_player_id", str(event_player_id)).execute()
    
    if not res.data:
        # Fallback if player doesn't exist in view
        return {
            "event_player_id": event_player_id,
            "player_name": "Unknown Player",
            "matches_played": 0,
            "minutes_played": 0,
            "goals": 0,
            "penalty_goals": 0,
            "assists": 0,
            "shots": 0,
            "shots_on_target": 0,
            "passes_attempted": 0,
            "passes_completed": 0,
            "key_passes": 0,
            "through_balls": 0,
            "crosses": 0,
            "dribbles_attempted": 0,
            "successful_dribbles": 0,
            "tackles_attempted": 0,
            "tackles_won": 0,
            "interceptions": 0,
            "recoveries": 0,
            "clearances": 0,
            "blocks": 0,
            "aerials_won": 0,
            "saves": 0,
            "penalty_saves": 0,
            "saves_1v1": 0,
            "fouls_committed": 0,
            "fouls_drawn": 0,
            "yellow_cards": 0,
            "red_cards": 0,
            "average_rating": None
        }
        
    return res.data[0]

@router.get("/teams/{team_registration_id}")
async def get_team_statistics(
    team_registration_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get aggregated statistics for a specific team.
    """
    # Get team name
    team_res = await supabase.table("event_team_registrations").select("team_name").eq("id", str(team_registration_id)).execute()
    team_name = team_res.data[0]["team_name"] if team_res.data else "Unknown Team"

    res = await supabase.table("tournament_standings_view").select("*").eq("team_id", str(team_registration_id)).execute()
    
    if not res.data:
        return {
            "team_registration_id": team_registration_id,
            "team_name": team_name,
            "matches_played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "goals_for": 0,
            "goals_against": 0,
            "goal_difference": 0,
            "points": 0,
            "clean_sheets": 0,
            "yellow_cards": 0,
            "red_cards": 0
        }
        
    row = res.data[0]
    return {
        "team_registration_id": team_registration_id,
        "team_name": team_name,
        "matches_played": row.get("matches_played", 0),
        "wins": row.get("wins", 0),
        "draws": row.get("draws", 0),
        "losses": row.get("losses", 0),
        "goals_for": row.get("goals_for", 0),
        "goals_against": row.get("goals_against", 0),
        "goal_difference": row.get("goal_difference", 0),
        "points": row.get("points", 0),
        "clean_sheets": row.get("clean_sheets", 0),
        "yellow_cards": row.get("yellow_cards", 0),
        "red_cards": row.get("red_cards", 0)
    }


@router.get("/tournament-kpis/{event_id}")
async def get_tournament_kpis(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get tournament high-level KPIs.
    """
    res = await supabase.table("tournament_kpis_view").select("*").eq("event_id", str(event_id)).execute()
    if not res.data:
        return {
            "event_id": str(event_id),
            "matches_played": 0,
            "total_goals": 0,
            "goals_per_match": 0,
            "total_assists": 0,
            "total_shots": 0,
            "shots_on_target": 0,
            "total_fouls": 0,
            "yellow_cards": 0,
            "red_cards": 0,
            "total_saves": 0,
            "successful_dribbles": 0
        }
    return res.data[0]

@router.get("/team-form/{event_id}")
async def get_team_form(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get the last 5 match form for all teams in a tournament.
    """
    res = await supabase.table("team_form_view").select("*").eq("event_id", str(event_id)).execute()
    if not res.data:
        return []
        
    team_ids = [r["team_id"] for r in res.data]
    teams_res = await supabase.table("event_team_registrations").select("id, team_name").in_("id", team_ids).execute()
    team_names = {t["id"]: t["team_name"] for t in teams_res.data}
    
    event_settings = await supabase.table("event_settings").select("*").eq("event_id", str(event_id)).execute()
    settings = event_settings.data[0] if event_settings.data else {}
    points_win = settings.get("points_win", 3)
    points_draw = settings.get("points_draw", 1)
    
    data = []
    for r in res.data:
        wins = r.get("wins_last_5", 0)
        draws = r.get("draws_last_5", 0)
        points = (wins * points_win) + (draws * points_draw)
        
        data.append({
            "team_id": r["team_id"],
            "team_name": team_names.get(r["team_id"], "Unknown Team"),
            "form_last_5": r.get("form_last_5", []),
            "last_5_points": points
        })
        
    return data

@router.get("/player-form/{event_id}")
async def get_player_form(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get the last 5 match average ratings for all players in a tournament.
    """
    res = await supabase.table("player_form_view").select("*").eq("event_id", str(event_id)).execute()
    if not res.data:
        return []
        
    player_ids = [r["event_player_id"] for r in res.data]
    players_res = await supabase.table("tournament_player_stats_view").select("event_player_id, player_unique_code, player_name, team_name").eq("event_id", str(event_id)).in_("event_player_id", player_ids).execute()
    players_map = {p["event_player_id"]: p for p in players_res.data}
    
    data = []
    for r in res.data:
        p_info = players_map.get(r["event_player_id"], {})
        ratings = r.get("ratings_last_5") or []
        data.append({
            "event_player_id": r["event_player_id"],
            "player_unique_code": p_info.get("player_unique_code", ""),
            "player_name": p_info.get("player_name", "Unknown Player"),
            "team_name": p_info.get("team_name", "Unknown Team"),
            "matches_played": len(ratings),
            "avg_rating": r.get("avg_rating_last_5")
        })
        
    data.sort(key=lambda x: x["avg_rating"] or 0, reverse=True)
    return data



@router.get("/match-statistics/{match_id}")
async def get_match_statistics_overview(
    match_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get Team A vs Team B metrics for a specific match.
    """
    res = await supabase.table("match_statistics_overview_view").select("*").eq("match_id", str(match_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Match stats not found")
    return res.data[0]

@router.get("/match-player-performance/{match_id}")
async def get_match_player_performance(
    match_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """
    Get Player Performance Table data for a specific match.
    """
    res = await supabase.table("match_player_performance_view").select("*").eq("match_id", str(match_id)).execute()
    return res.data



@router.get("/tournament-records/{event_id}/goals")
async def get_tournament_goals(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get all goals scored in a tournament."""
    # Use RPC or complex join
    # Actually, postgrest can do:
    res = await supabase.table("match_timeline_events") \
        .select("id, display_minute, metadata, matches!inner(event_id, title), actor:actor_player_id(users(display_name, username))") \
        .eq("matches.event_id", str(event_id)) \
        .eq("event_type", "SHOT") \
        .eq("metadata->>result", "GOAL") \
        .order("created_at", desc=True) \
        .execute()
    
    return res.data

@router.get("/tournament-records/{event_id}/cards")
async def get_tournament_cards(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get all cards issued in a tournament."""
    res = await supabase.table("match_timeline_events") \
        .select("id, display_minute, event_type, matches!inner(event_id, title), actor:actor_player_id(users(display_name, username))") \
        .eq("matches.event_id", str(event_id)) \
        .in_("event_type", ["YELLOW_CARD", "RED_CARD"]) \
        .order("created_at", desc=True) \
        .execute()
    
    return res.data

@router.get("/advanced/clutch/{event_id}")
async def get_advanced_clutch(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get clutch performance metrics for players (GWG, Equalizers, Late Goals)."""
    res = await supabase.table("tournament_clutch_player_stats_view").select("*").eq("tournament_id", str(event_id)).execute()
    
    if not res.data:
        return []
        
    player_ids = [r["event_player_id"] for r in res.data]
    players_res = await supabase.table("tournament_player_stats_view").select("event_player_id, player_unique_code, player_name, team_name").eq("event_id", str(event_id)).in_("event_player_id", player_ids).execute()
    players_map = {p["event_player_id"]: p for p in players_res.data}
    
    data = []
    for r in res.data:
        p_info = players_map.get(r["event_player_id"], {})
        data.append({
            "event_player_id": r["event_player_id"],
            "player_unique_code": p_info.get("player_unique_code", ""),
            "player_name": p_info.get("player_name", "Unknown Player"),
            "team_name": p_info.get("team_name", "Unknown Team"),
            "total_goals": r.get("total_goals", 0),
            "gwg": r.get("gwg", 0),
            "equalizers": r.get("equalizers", 0),
            "late_goals": r.get("late_goals", 0)
        })
        
    data.sort(key=lambda x: (x["gwg"] + x["equalizers"] + x["late_goals"]), reverse=True)
    return data

@router.get("/advanced/comebacks/{event_id}")
async def get_advanced_comebacks(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get team comeback metrics."""
    res = await supabase.table("tournament_comeback_team_stats_view").select("*").eq("tournament_id", str(event_id)).execute()
    
    if not res.data:
        return []
        
    team_ids = [r["team_id"] for r in res.data]
    teams_res = await supabase.table("event_team_registrations").select("id, team_name").in_("id", team_ids).execute()
    teams_map = {t["id"]: t["team_name"] for t in teams_res.data}
    
    data = []
    for r in res.data:
        data.append({
            "team_id": r["team_id"],
            "team_name": teams_map.get(r["team_id"], "Unknown Team"),
            "times_fell_behind": r.get("times_fell_behind", 0),
            "comeback_wins": r.get("comeback_wins", 0),
            "comeback_draws": r.get("comeback_draws", 0),
            "total_comebacks": r.get("total_comebacks", 0)
        })
        
    data.sort(key=lambda x: (x["comeback_wins"], x["total_comebacks"]), reverse=True)
    return data

@router.get("/advanced/records/{event_id}")
async def get_advanced_records(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get high-level extreme records for a tournament."""
    res = await supabase.table("tournament_records_view").select("*").eq("tournament_id", str(event_id)).execute()
    return res.data[0] if res.data else {
        "tournament_id": str(event_id),
        "highest_scoring_match": 0,
        "biggest_win_margin": 0,
        "most_goals_by_one_team": 0,
        "highest_scoring_draw": 0
    }

@router.get("/advanced/trends/{event_id}")
async def get_advanced_trends(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get trend data for a tournament grouped by date."""
    res = await supabase.table("tournament_trends_view").select("*").eq("tournament_id", str(event_id)).order("match_date").execute()
    return res.data

@router.get("/granular/shot-map/{event_id}")
async def get_granular_shot_map(
    event_id: UUID,
    team_id: Optional[UUID] = None,
    player_id: Optional[UUID] = None,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get spatial shot map data for a tournament."""
    query = supabase.table("tournament_shot_map_view").select("*").eq("tournament_id", str(event_id))
    
    if team_id:
        query = query.eq("team_id", str(team_id))
    if player_id:
        query = query.eq("player_id", str(player_id))
        
    res = await query.execute()
    return res.data

@router.get("/granular/playmaking/{event_id}")
async def get_granular_playmaking(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get granular playmaking leaderboards."""
    res = await supabase.table("tournament_player_stats_view").select(
        "event_player_id, player_name, team_name, player_unique_code, matches_played, key_passes, through_balls, crosses, big_chances_created, ankle_breakers, nutmegs"
    ).eq("event_id", str(event_id)).execute()
    
    # Python-side sort to return multiple leaderboards
    data = res.data
    return {
        "big_chances": sorted(data, key=lambda x: x.get("big_chances_created") or 0, reverse=True)[:10],
        "key_passes": sorted(data, key=lambda x: x.get("key_passes") or 0, reverse=True)[:10],
        "through_balls": sorted(data, key=lambda x: x.get("through_balls") or 0, reverse=True)[:10],
        "crosses": sorted(data, key=lambda x: x.get("crosses") or 0, reverse=True)[:10],
        "nutmegs": sorted(data, key=lambda x: x.get("nutmegs") or 0, reverse=True)[:10],
        "ankle_breakers": sorted(data, key=lambda x: x.get("ankle_breakers") or 0, reverse=True)[:10],
    }

@router.get("/granular/goalkeeping/{event_id}")
async def get_granular_goalkeeping(
    event_id: UUID,
    supabase: AsyncClient = Depends(get_async_service_supabase)
):
    """Get granular goalkeeping leaderboards."""
    res = await supabase.table("tournament_player_stats_view").select(
        "event_player_id, player_name, team_name, player_unique_code, matches_played, saves, shots_on_target, penalty_saves, saves_1v1, aerial_claims, sweeper_actions"
    ).eq("event_id", str(event_id)).execute()
    
    # Calculate save percentage
    data = res.data
    for p in data:
        # Shots on target faced by the goalkeeper is technically total saves + goals conceded
        # We don't have goals_conceded per player right here easily, so we use saves as the raw metric.
        pass
        
    return {
        "saves": sorted(data, key=lambda x: x.get("saves") or 0, reverse=True)[:10],
        "penalty_saves": sorted(data, key=lambda x: x.get("penalty_saves") or 0, reverse=True)[:10],
        "saves_1v1": sorted(data, key=lambda x: x.get("saves_1v1") or 0, reverse=True)[:10],
        "aerial_claims": sorted(data, key=lambda x: x.get("aerial_claims") or 0, reverse=True)[:10],
        "sweeper_actions": sorted(data, key=lambda x: x.get("sweeper_actions") or 0, reverse=True)[:10],
    }
