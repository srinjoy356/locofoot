-- Phase 4: Statistics Derivations

BEGIN;

-- Player Match Statistics (Derived View)
CREATE OR REPLACE VIEW public.player_match_stats_view AS
SELECT 
    mte.match_id,
    mte.actor_player_id AS event_player_id,
    COUNT(*) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
    COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'assist' = 'true') AS assists,
    COUNT(*) FILTER (WHERE mte.event_type = 'SHOT') AS shots,
    COUNT(*) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
    COUNT(*) FILTER (WHERE mte.event_type = 'PASS') AS passes_attempted,
    COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS passes_completed,
    COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
    COUNT(*) FILTER (WHERE mte.event_type = 'TACKLE' AND mte.metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
    COUNT(*) FILTER (WHERE mte.event_type = 'INTERCEPTION') AS interceptions,
    COUNT(*) FILTER (WHERE mte.event_type = 'SAVE') AS saves
FROM public.match_timeline_events mte
WHERE mte.actor_player_id IS NOT NULL
GROUP BY mte.match_id, mte.actor_player_id;

-- Referee Discipline Stats View
CREATE OR REPLACE VIEW public.player_discipline_stats_view AS
SELECT 
    re.match_id,
    re.event_player_id,
    COUNT(*) FILTER (WHERE re.event_type = 'FOUL') AS fouls_committed,
    COUNT(*) FILTER (WHERE re.event_type = 'YELLOW_CARD') AS yellow_cards,
    COUNT(*) FILTER (WHERE re.event_type = 'RED_CARD') AS red_cards
FROM public.referee_events re
WHERE re.event_player_id IS NOT NULL
GROUP BY re.match_id, re.event_player_id;

COMMIT;
