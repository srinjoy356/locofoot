-- After-match numbers that did not add up (found by replaying known events through the API and comparing):
--  1. Assists recorded on the goal (assist_player_id) were never counted: only PASS events carrying qualifier=ASSIST were.
--  2. Team shots on target counted woodwork, player shots on target did not; team aerials counted lost duels as won.
--  3. Unused substitutes were credited with a full match of minutes.
-- All three views keep their exact column lists, so dependent views are untouched.

CREATE OR REPLACE VIEW public.player_match_stats_view AS
WITH timeline_events_with_lead AS (
    SELECT 
        mte.match_id,
        mte.actor_player_id AS event_player_id,
        mte.event_type,
        mte.metadata,
        mte.is_nutmeg,
        mte.actor_registration_id,
        LEAD(mte.event_type) OVER (PARTITION BY mte.match_id, mte.actor_registration_id ORDER BY mte.created_at) AS next_team_event_type,
        LEAD(mte.metadata->>'result') OVER (PARTITION BY mte.match_id, mte.actor_registration_id ORDER BY mte.created_at) AS next_team_event_result
    FROM public.match_timeline_events mte
    WHERE mte.actor_player_id IS NOT NULL
),
timeline_aggs AS (
    SELECT 
        match_id,
        event_player_id,
        COUNT(*) FILTER (WHERE event_type = 'SHOT' AND metadata->>'result' = 'GOAL') AS goals,
        COUNT(*) FILTER (WHERE event_type = 'SHOT' AND metadata->>'result' = 'GOAL' AND metadata->>'situation' = 'PENALTY') AS penalty_goals,
        COUNT(*) FILTER (WHERE event_type = 'SHOT') AS shots,
        COUNT(*) FILTER (WHERE event_type = 'SHOT' AND metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        
        -- Passes
        COUNT(*) FILTER (WHERE event_type = 'PASS') AS passes_attempted,
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'result' = 'COMPLETED') AS passes_completed,
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'type' = 'THROUGH_BALL' AND metadata->>'result' = 'COMPLETED') AS through_balls,
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'type' = 'CROSS' AND metadata->>'result' = 'COMPLETED') AS crosses,
        
        -- Key Passes & Assists
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND (metadata->>'qualifier' = 'ASSIST' OR metadata->>'assist' = 'true')) AS assists,
        -- Relational Key Pass
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'result' = 'COMPLETED' AND next_team_event_type = 'SHOT' AND next_team_event_result IN ('GOAL', 'SAVED')) AS key_passes,
        
        -- Dribbling & Control
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE') AS dribbles_attempted,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND (metadata->>'opponents_beaten')::int >= 2) AS ankle_breakers,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND is_nutmeg = true) AS nutmegs,
        COUNT(*) FILTER (WHERE event_type = 'GREAT_FIRST_TOUCH') AS great_first_touches,
        
        -- Defending
        COUNT(*) FILTER (WHERE event_type = 'TACKLE') AS tackles_attempted,
        COUNT(*) FILTER (WHERE event_type = 'TACKLE' AND metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(*) FILTER (WHERE event_type = 'INTERCEPTION') AS interceptions,
        COUNT(*) FILTER (WHERE event_type = 'BALL_RECOVERY') AS recoveries,
        COUNT(*) FILTER (WHERE event_type = 'CLEARANCE') AS clearances,
        COUNT(*) FILTER (WHERE event_type = 'BLOCK') AS blocks,
        COUNT(*) FILTER (WHERE event_type = 'AERIAL_DUEL' AND metadata->>'result' = 'WON') AS aerials_won,
        
        -- Goalkeeping
        COUNT(*) FILTER (WHERE event_type = 'SAVE') AS saves,
        COUNT(*) FILTER (WHERE event_type = 'SAVE' AND metadata->>'context' = 'PENALTY') AS penalty_saves,
        COUNT(*) FILTER (WHERE event_type = 'SAVE' AND metadata->>'context' = '1V1') AS saves_1v1
    FROM timeline_events_with_lead
    GROUP BY match_id, event_player_id
),
assist_goal_aggs AS (
    -- assists recorded on the goal itself (Quick scorer / goal form): one per goal
    SELECT mte.match_id, mte.assist_player_id AS event_player_id, COUNT(*) AS assists
    FROM public.match_timeline_events mte
    WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' = 'GOAL' AND mte.assist_player_id IS NOT NULL
    GROUP BY mte.match_id, mte.assist_player_id
),
referee_aggs AS (
    SELECT 
        re.match_id,
        re.event_player_id,
        COUNT(*) FILTER (WHERE re.event_type = 'FOUL') AS fouls_committed,
        COUNT(*) FILTER (WHERE re.event_type = 'YELLOW_CARD') AS yellow_cards,
        COUNT(*) FILTER (WHERE re.event_type = 'RED_CARD') AS red_cards
    FROM public.referee_events re
    WHERE re.event_player_id IS NOT NULL
    GROUP BY re.match_id, re.event_player_id
),
fouls_drawn_aggs AS (
    SELECT 
        re.match_id,
        re.target_player_id AS event_player_id,
        COUNT(*) AS fouls_drawn
    FROM public.referee_events re
    WHERE re.event_type = 'FOUL' AND re.target_player_id IS NOT NULL
    GROUP BY re.match_id, re.target_player_id
)
SELECT 
    COALESCE(t.match_id, r.match_id, fd.match_id, ag.match_id) AS match_id,
    COALESCE(t.event_player_id, r.event_player_id, fd.event_player_id, ag.event_player_id) AS event_player_id,
    
    COALESCE(t.goals, 0) AS goals,
    COALESCE(t.penalty_goals, 0) AS penalty_goals,
    COALESCE(t.assists, 0) + COALESCE(ag.assists, 0) AS assists,
    COALESCE(t.shots, 0) AS shots,
    COALESCE(t.shots_on_target, 0) AS shots_on_target,
    
    COALESCE(t.passes_attempted, 0) AS passes_attempted,
    COALESCE(t.passes_completed, 0) AS passes_completed,
    COALESCE(t.key_passes, 0) AS key_passes,
    COALESCE(t.through_balls, 0) AS through_balls,
    COALESCE(t.crosses, 0) AS crosses,
    
    COALESCE(t.dribbles_attempted, 0) AS dribbles_attempted,
    COALESCE(t.successful_dribbles, 0) AS successful_dribbles,
    COALESCE(t.ankle_breakers, 0) AS ankle_breakers,
    COALESCE(t.nutmegs, 0) AS nutmegs,
    COALESCE(t.great_first_touches, 0) AS great_first_touches,
    
    COALESCE(t.tackles_attempted, 0) AS tackles_attempted,
    COALESCE(t.tackles_won, 0) AS tackles_won,
    COALESCE(t.interceptions, 0) AS interceptions,
    COALESCE(t.recoveries, 0) AS recoveries,
    COALESCE(t.clearances, 0) AS clearances,
    COALESCE(t.blocks, 0) AS blocks,
    COALESCE(t.aerials_won, 0) AS aerials_won,
    
    COALESCE(t.saves, 0) AS saves,
    COALESCE(t.penalty_saves, 0) AS penalty_saves,
    COALESCE(t.saves_1v1, 0) AS saves_1v1,
    
    COALESCE(r.fouls_committed, 0) AS fouls_committed,
    COALESCE(fd.fouls_drawn, 0) AS fouls_drawn,
    COALESCE(r.yellow_cards, 0) AS yellow_cards,
    COALESCE(r.red_cards, 0) AS red_cards
    
FROM timeline_aggs t
FULL OUTER JOIN referee_aggs r ON t.match_id = r.match_id AND t.event_player_id = r.event_player_id
FULL OUTER JOIN fouls_drawn_aggs fd ON COALESCE(t.match_id, r.match_id) = fd.match_id AND COALESCE(t.event_player_id, r.event_player_id) = fd.event_player_id
FULL OUTER JOIN assist_goal_aggs ag ON COALESCE(t.match_id, r.match_id, fd.match_id) = ag.match_id AND COALESCE(t.event_player_id, r.event_player_id, fd.event_player_id) = ag.event_player_id;

CREATE OR REPLACE VIEW public.match_statistics_overview_view AS
WITH match_info AS (
    SELECT 
        m.id,
        m.home_registration_id,
        m.away_registration_id,
        m.home_score,
        m.away_score
    FROM public.matches m
),
home_stats AS (
    SELECT 
        m.id AS match_id,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
        COUNT(mte.id) FILTER (WHERE (mte.event_type::text = 'PASS' AND mte.metadata->>'qualifier' = 'ASSIST') OR (mte.event_type::text = 'SHOT' AND mte.metadata->>'result' = 'GOAL' AND mte.assist_player_id IS NOT NULL)) AS assists,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT') AS shots,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS') AS passes,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS passes_completed,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'TACKLE' AND mte.metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'INTERCEPTION' OR (mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' = 'INTERCEPTION')) AS interceptions,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' != 'INTERCEPTION' AND mte.metadata->>'type' != 'CLEARANCE') AS recoveries,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'CLEARANCE' OR (mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' = 'CLEARANCE')) AS clearances,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'AERIAL_DUEL' AND mte.metadata->>'result' = 'WON') AS aerial_duels_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BLOCK') AS blocks,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SAVE') AS saves,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'GREAT_FIRST_TOUCH') AS great_first_touches
    FROM match_info m
    LEFT JOIN public.match_timeline_events mte ON mte.match_id = m.id AND mte.actor_registration_id = m.home_registration_id
    GROUP BY m.id
),
away_stats AS (
    SELECT 
        m.id AS match_id,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
        COUNT(mte.id) FILTER (WHERE (mte.event_type::text = 'PASS' AND mte.metadata->>'qualifier' = 'ASSIST') OR (mte.event_type::text = 'SHOT' AND mte.metadata->>'result' = 'GOAL' AND mte.assist_player_id IS NOT NULL)) AS assists,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT') AS shots,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS') AS passes,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS passes_completed,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'TACKLE' AND mte.metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'INTERCEPTION' OR (mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' = 'INTERCEPTION')) AS interceptions,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' != 'INTERCEPTION' AND mte.metadata->>'type' != 'CLEARANCE') AS recoveries,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'CLEARANCE' OR (mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' = 'CLEARANCE')) AS clearances,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'AERIAL_DUEL' AND mte.metadata->>'result' = 'WON') AS aerial_duels_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BLOCK') AS blocks,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SAVE') AS saves,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'GREAT_FIRST_TOUCH') AS great_first_touches
    FROM match_info m
    LEFT JOIN public.match_timeline_events mte ON mte.match_id = m.id AND mte.actor_registration_id = m.away_registration_id
    GROUP BY m.id
),
home_referee AS (
    SELECT 
        m.id AS match_id,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'FOUL') AS fouls,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'YELLOW_CARD') AS yellow_cards,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'RED_CARD') AS red_cards
    FROM match_info m
    LEFT JOIN public.referee_events re ON re.match_id = m.id AND re.event_registration_id = m.home_registration_id
    GROUP BY m.id
),
away_referee AS (
    SELECT 
        m.id AS match_id,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'FOUL') AS fouls,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'YELLOW_CARD') AS yellow_cards,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'RED_CARD') AS red_cards
    FROM match_info m
    LEFT JOIN public.referee_events re ON re.match_id = m.id AND re.event_registration_id = m.away_registration_id
    GROUP BY m.id
)
SELECT 
    m.id AS match_id,
    COALESCE(h.goals, 0) AS home_goals,
    COALESCE(a.goals, 0) AS away_goals,
    COALESCE(h.assists, 0) AS home_assists,
    COALESCE(a.assists, 0) AS away_assists,
    COALESCE(h.shots, 0) AS home_shots,
    COALESCE(a.shots, 0) AS away_shots,
    COALESCE(h.shots_on_target, 0) AS home_shots_on_target,
    COALESCE(a.shots_on_target, 0) AS away_shots_on_target,
    COALESCE(h.passes, 0) AS home_passes,
    COALESCE(a.passes, 0) AS away_passes,
    COALESCE(h.passes_completed, 0) AS home_passes_completed,
    COALESCE(a.passes_completed, 0) AS away_passes_completed,
    CASE WHEN COALESCE(h.passes, 0) > 0 THEN ROUND((h.passes_completed::numeric / h.passes::numeric) * 100, 1) ELSE 0 END AS home_pass_accuracy_percent,
    CASE WHEN COALESCE(a.passes, 0) > 0 THEN ROUND((a.passes_completed::numeric / a.passes::numeric) * 100, 1) ELSE 0 END AS away_pass_accuracy_percent,
    COALESCE(h.successful_dribbles, 0) AS home_successful_dribbles,
    COALESCE(a.successful_dribbles, 0) AS away_successful_dribbles,
    COALESCE(h.tackles_won, 0) AS home_tackles_won,
    COALESCE(a.tackles_won, 0) AS away_tackles_won,
    COALESCE(h.interceptions, 0) AS home_interceptions,
    COALESCE(a.interceptions, 0) AS away_interceptions,
    COALESCE(h.recoveries, 0) AS home_recoveries,
    COALESCE(a.recoveries, 0) AS away_recoveries,
    COALESCE(h.clearances, 0) AS home_clearances,
    COALESCE(a.clearances, 0) AS away_clearances,
    COALESCE(h.aerial_duels_won, 0) AS home_aerial_duels_won,
    COALESCE(a.aerial_duels_won, 0) AS away_aerial_duels_won,
    COALESCE(h.blocks, 0) AS home_blocks,
    COALESCE(a.blocks, 0) AS away_blocks,
    COALESCE(h.saves, 0) AS home_saves,
    COALESCE(a.saves, 0) AS away_saves,
    COALESCE(h.great_first_touches, 0) AS home_great_first_touches,
    COALESCE(a.great_first_touches, 0) AS away_great_first_touches,
    
    COALESCE(hr.fouls, 0) AS home_fouls,
    COALESCE(ar.fouls, 0) AS away_fouls,
    COALESCE(hr.yellow_cards, 0) AS home_yellow_cards,
    COALESCE(ar.yellow_cards, 0) AS away_yellow_cards,
    COALESCE(hr.red_cards, 0) AS home_red_cards,
    COALESCE(ar.red_cards, 0) AS away_red_cards

FROM public.matches m
LEFT JOIN home_stats h ON h.match_id = m.id
LEFT JOIN away_stats a ON a.match_id = m.id
LEFT JOIN home_referee hr ON hr.match_id = m.id
LEFT JOIN away_referee ar ON ar.match_id = m.id;

CREATE OR REPLACE VIEW public.match_player_performance_view AS
SELECT 
    COALESCE(mp.match_id, pms.match_id, pds.match_id) AS match_id,
    COALESCE(mp.event_player_id, pms.event_player_id, pds.event_player_id) AS player_id,
    COALESCE(u.display_name, u.username, etp.guest_name, 'Unknown Player') AS player_name,
    COALESCE(mp.event_registration_id, etp.event_registration_id) AS registration_id,
    COALESCE(mp.status, 'STARTER'::public.participation_status) AS status,
    CASE WHEN mp.status = 'SUBSTITUTE' AND mp.entry_elapsed_seconds IS NULL THEN 0 ELSE COALESCE(
        ROUND((
            COALESCE(
                mp.exit_elapsed_seconds, 
                (SELECT MAX(elapsed_seconds) FROM public.match_timeline_events WHERE match_id = COALESCE(mp.match_id, pms.match_id, pds.match_id)),
                5400
            ) - COALESCE(mp.entry_elapsed_seconds, 0)
        )::numeric / 60, 0), 
    0) END AS minutes_played,
    COALESCE(pms.goals, 0) AS goals,
    COALESCE(pms.assists, 0) AS assists,
    COALESCE(pms.shots, 0) AS shots,
    COALESCE(pms.shots_on_target, 0) AS shots_on_target,
    COALESCE(pms.passes_attempted, 0) AS passes_attempted,
    COALESCE(pms.passes_completed, 0) AS passes_completed,
    CASE WHEN pms.passes_attempted > 0 THEN ROUND((pms.passes_completed::numeric / pms.passes_attempted::numeric) * 100, 1) ELSE 0 END AS pass_accuracy,
    COALESCE(pms.successful_dribbles, 0) AS successful_dribbles,
    COALESCE(pms.tackles_won, 0) AS tackles_won,
    COALESCE(pms.recoveries, 0) AS recoveries,
    COALESCE(pds.fouls_committed, 0) AS fouls_committed,
    COALESCE(pds.yellow_cards, 0) AS yellow_cards,
    COALESCE(pds.red_cards, 0) AS red_cards,
    mpr.rating,
    mpr.is_potm AS is_mvp
FROM public.match_participation mp
FULL OUTER JOIN public.player_match_stats_view pms ON pms.match_id = mp.match_id AND pms.event_player_id = mp.event_player_id
FULL OUTER JOIN public.player_discipline_stats_view pds ON pds.match_id = COALESCE(mp.match_id, pms.match_id) AND pds.event_player_id = COALESCE(mp.event_player_id, pms.event_player_id)
LEFT JOIN public.event_team_players etp ON etp.id = COALESCE(mp.event_player_id, pms.event_player_id, pds.event_player_id)
LEFT JOIN public.users u ON u.id = etp.user_id
LEFT JOIN public.match_player_ratings mpr ON mpr.match_id = COALESCE(mp.match_id, pms.match_id, pds.match_id) AND mpr.event_player_id = COALESCE(mp.event_player_id, pms.event_player_id, pds.event_player_id);
