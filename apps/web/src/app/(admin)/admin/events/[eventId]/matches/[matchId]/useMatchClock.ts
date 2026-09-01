import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MatchState, MatchPeriod } from '@locofoot/shared-types';

export function useMatchClock(eventId: string, matchId: string) {
  const [matchState, setMatchState] = useState<MatchState>('SCHEDULED' as MatchState);
  const [elapsed, setElapsed] = useState(0);
  const [eventSettings, setEventSettings] = useState<any>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [previousActiveState, setPreviousActiveState] = useState<MatchState>('LIVE' as MatchState);

  useEffect(() => {
    const supabase = createClient();

    const fetchInitialData = async () => {
      // Basic UUID validation
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
      
      const promises: any[] = [
        supabase.from('matches').select('match_state, match_started_at, half_started_at, paused_at').eq('id', matchId).maybeSingle(),
        supabase.from('match_state_transitions').select('previous_state, new_state').eq('match_id', matchId).order('created_at', { ascending: false }).limit(20)
      ];
      
      if (isUuid) {
        promises.push(supabase.from('event_settings').select('*').eq('event_id', eventId).maybeSingle());
      }

      const results = await Promise.all(promises);
      const matchRes = results[0];
      const transitionsRes = results[1];
      const settingsRes = isUuid ? results[2] : { data: null };

      if (settingsRes.data) setEventSettings(settingsRes.data);
      if (matchRes.data) {
        setMatchData(matchRes.data);
        setMatchState(matchRes.data.match_state as MatchState);
      }
      
      if (transitionsRes.data) {
        const activeStates = ['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'];
        for (const t of transitionsRes.data) {
           if (activeStates.includes(t.previous_state)) {
             setPreviousActiveState(t.previous_state as MatchState);
             break;
           }
        }
      }
    };

    fetchInitialData();

    const channel = supabase.channel(`match:${matchId}:clock`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        setMatchData(payload.new);
        setMatchState(prev => {
           const activeStates = ['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'];
           if (activeStates.includes(prev)) {
              setPreviousActiveState(prev);
           }
           return payload.new.match_state as MatchState;
        });
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [eventId, matchId]);

  useEffect(() => {
    let timer: any;
    
    const calculateElapsed = () => {
      if (!matchData) return 0;
      if (!matchData.half_started_at) return 0;

      const halfStart = new Date(matchData.half_started_at).getTime();
      const now = new Date().getTime();
      
      let baseSeconds = 0;
      if (matchState === 'SECOND_HALF' && eventSettings) {
        baseSeconds = eventSettings.first_half_minutes * 60;
      } else if (matchState === 'EXTRA_TIME_1' && eventSettings) {
        baseSeconds = (eventSettings.first_half_minutes + eventSettings.second_half_minutes) * 60;
      } else if (matchState === 'EXTRA_TIME_2' && eventSettings) {
        baseSeconds = (eventSettings.first_half_minutes + eventSettings.second_half_minutes + eventSettings.extra_time_minutes / 2) * 60;
      }

      if (matchState === 'PAUSED' || matchState === 'HALF_TIME' || matchState === 'FULL_TIME') {
        if (matchData.paused_at) {
          const pausedAt = new Date(matchData.paused_at).getTime();
          return Math.floor((pausedAt - halfStart) / 1000) + baseSeconds;
        }
      }

      return Math.floor((now - halfStart) / 1000) + baseSeconds;
    };

    if (matchState === 'LIVE' || matchState === 'SECOND_HALF' || matchState === 'EXTRA_TIME_1' || matchState === 'EXTRA_TIME_2') {
      setElapsed(calculateElapsed());
      timer = setInterval(() => {
        setElapsed(calculateElapsed());
      }, 1000);
    } else {
      setElapsed(calculateElapsed());
    }
    
    return () => clearInterval(timer);
  }, [matchState, matchData, eventSettings]);

  const formatClock = () => {
    let baseTimeMinutes = 45; // safe default
    let injuryTimeTracking = true;
    if (eventSettings) {
      if (eventSettings.injury_time_tracking !== undefined && eventSettings.injury_time_tracking !== null) {
        injuryTimeTracking = eventSettings.injury_time_tracking;
      }
      
      if (matchState === 'LIVE' || matchState === 'PAUSED' || matchState === 'HALF_TIME') {
        baseTimeMinutes = eventSettings.first_half_minutes;
      } else if (matchState === 'SECOND_HALF' || matchState === 'FULL_TIME') {
        baseTimeMinutes = eventSettings.first_half_minutes + eventSettings.second_half_minutes;
      } else if (matchState === 'EXTRA_TIME_1' || matchState === 'EXTRA_TIME_BREAK') {
        baseTimeMinutes = eventSettings.first_half_minutes + eventSettings.second_half_minutes + (eventSettings.extra_time_minutes / 2);
      } else if (matchState === 'EXTRA_TIME_2') {
        baseTimeMinutes = eventSettings.first_half_minutes + eventSettings.second_half_minutes + eventSettings.extra_time_minutes;
      }
    }

    const totalMinutes = Math.floor(elapsed / 60);
    const totalSeconds = elapsed % 60;

    if (injuryTimeTracking && totalMinutes >= baseTimeMinutes) {
      const addedMinutes = totalMinutes - baseTimeMinutes;
      return `${baseTimeMinutes.toString().padStart(2, '0')}:00 + ${addedMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
    }

    return `${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
  };

  const getPeriod = (): MatchPeriod => {
    if (matchState === 'SECOND_HALF') return 'SECOND_HALF' as MatchPeriod;
    if (matchState === 'EXTRA_TIME_1') return 'EXTRA_TIME_1' as MatchPeriod;
    if (matchState === 'EXTRA_TIME_2') return 'EXTRA_TIME_2' as MatchPeriod;
    if (matchState === 'PENALTY_SHOOTOUT') return 'PENALTY_SHOOTOUT' as MatchPeriod;
    if (matchState === 'PAUSED') {
       if (previousActiveState === 'SECOND_HALF') return 'SECOND_HALF' as MatchPeriod;
       if (previousActiveState === 'EXTRA_TIME_1') return 'EXTRA_TIME_1' as MatchPeriod;
       if (previousActiveState === 'EXTRA_TIME_2') return 'EXTRA_TIME_2' as MatchPeriod;
    }
    return 'FIRST_HALF' as MatchPeriod;
  };

  const isHalfTimeAllowed = () => {
    if (!eventSettings) return false;
    const firstHalfMins = eventSettings.first_half_minutes || 45;
    return elapsed >= firstHalfMins * 60;
  };

  const isFullTimeAllowed = () => {
    if (!eventSettings) return false;
    const totalMins = (eventSettings.first_half_minutes || 45) + (eventSettings.second_half_minutes || 45);
    return elapsed >= totalMins * 60;
  };

  return { elapsed, formatClock, matchState, eventSettings, getPeriod, isHalfTimeAllowed, isFullTimeAllowed, previousActiveState };
}
