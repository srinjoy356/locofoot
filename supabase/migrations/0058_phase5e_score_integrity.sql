-- Phase 5E: Match Score Integrity
-- Synchronizes match_timeline_events (authoritative) with matches.home_score/away_score

BEGIN;

-- 1. Create the score recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_match_score(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
    v_home_reg_id UUID;
    v_away_reg_id UUID;
    v_home_score INT := 0;
    v_away_score INT := 0;
BEGIN
    -- Get team registration IDs for the match
    SELECT home_registration_id, away_registration_id
    INTO v_home_reg_id, v_away_reg_id
    FROM public.matches
    WHERE id = p_match_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Calculate home goals from authoritative timeline events
    SELECT COUNT(*)
    INTO v_home_score
    FROM public.match_timeline_events
    WHERE match_id = p_match_id
      AND event_type = 'SHOT'
      AND metadata->>'result' = 'GOAL'
      AND actor_registration_id = v_home_reg_id;

    -- Calculate away goals from authoritative timeline events
    SELECT COUNT(*)
    INTO v_away_score
    FROM public.match_timeline_events
    WHERE match_id = p_match_id
      AND event_type = 'SHOT'
      AND metadata->>'result' = 'GOAL'
      AND actor_registration_id = v_away_reg_id;

    -- Update the matches table safely
    UPDATE public.matches
    SET home_score = v_home_score,
        away_score = v_away_score
    WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_recalculate_match_score()
RETURNS TRIGGER AS $$
DECLARE
    v_match_id UUID;
    v_old_match_id UUID;
BEGIN
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        -- Only recalculate if it was a goal that got deleted
        IF OLD.event_type = 'SHOT' AND OLD.metadata->>'result' = 'GOAL' THEN
            PERFORM public.recalculate_match_score(OLD.match_id);
        END IF;
        RETURN OLD;
    END IF;

    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Only recalculate if a goal was inserted
        IF NEW.event_type = 'SHOT' AND NEW.metadata->>'result' = 'GOAL' THEN
            PERFORM public.recalculate_match_score(NEW.match_id);
        END IF;
        RETURN NEW;
    END IF;

    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Check if anything score-relevant changed
        IF (OLD.event_type != NEW.event_type) OR 
           (OLD.metadata->>'result' IS DISTINCT FROM NEW.metadata->>'result') OR
           (OLD.actor_registration_id IS DISTINCT FROM NEW.actor_registration_id) OR
           (OLD.match_id IS DISTINCT FROM NEW.match_id) THEN
            
            -- If match_id changed, recalculate both old and new
            IF OLD.match_id != NEW.match_id THEN
                PERFORM public.recalculate_match_score(OLD.match_id);
                PERFORM public.recalculate_match_score(NEW.match_id);
            ELSE
                -- Otherwise just recalculate the current match
                PERFORM public.recalculate_match_score(NEW.match_id);
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to match_timeline_events
DROP TRIGGER IF EXISTS trg_recalculate_match_score ON public.match_timeline_events;
CREATE TRIGGER trg_recalculate_match_score
AFTER INSERT OR UPDATE OR DELETE ON public.match_timeline_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalculate_match_score();

COMMIT;
