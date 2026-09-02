'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MatchState, RefereeEventType, MatchPeriod } from '@locofoot/shared-types';
import { useMatchClock } from '../useMatchClock';
import { useMatchPlayers, MatchPlayer } from '../useMatchPlayers';
import { MatchAuditLog } from '@/components/MatchAuditLog';
import { SubstitutionModal } from '@/components/SubstitutionModal';
import { FoulModal } from '@/components/FoulModal';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function RefereePage({ params }: { params: Promise<{ eventId: string, matchId: string }> }) {
  const { eventId, matchId } = React.use(params);
  const supabase = createClient();
  
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const { elapsed, formatClock, matchState, isHalfTimeAllowed, isFullTimeAllowed, previousActiveState, getPeriod } = useMatchClock(eventId, matchId);
  const { players, loading: playersLoading } = useMatchPlayers(matchId);

  const [pendingEvent, setPendingEvent] = useState<{ type: RefereeEventType } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthorized(false);
        return;
      }
      const { data: refData } = await supabase.from('match_referees')
        .select('id')
        .eq('match_id', matchId)
        .eq('user_id', session.user.id)
        .maybeSingle();

      setIsAuthorized(!!refData);
    };
    checkAuth();
  }, [matchId]);

  const changeState = async (newState: MatchState) => {
    if (newState === 'HALF_TIME' && !isHalfTimeAllowed()) {
      alert("Half time cannot be started until the base minutes have elapsed!");
      return;
    }

    try {
      const res = await fetch(`/api/v1/events/${eventId}/matches/${matchId}/referee/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ idempotency_key: generateUUID(), new_state: newState })
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`API Error: ${res.status} ${text}`);
      }
    } catch (e: any) {
      alert(`Fetch Error: ${e.message}`);
    }
  };

  const handleEventClick = (type: RefereeEventType) => {
    setPendingEvent({ type });
  };

  const confirmEvent = async (player: MatchPlayer | null) => {
    if (!pendingEvent) return;
    
    await fetch(`/api/v1/events/${eventId}/matches/${matchId}/referee/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      body: JSON.stringify({
        id: generateUUID(),
        event_type: pendingEvent.type,
        period: getPeriod(),
        elapsed_seconds: elapsed,
        display_minute: Math.floor(elapsed / 60),
        display_second: elapsed % 60,
        event_player_id: player ? player.id : undefined,
        event_registration_id: player ? player.registration_id : undefined,
        metadata: {}
      })
    });

    setPendingEvent(null);
  };

  const confirmSubstitution = async (playerOut: MatchPlayer | null, playerIn: MatchPlayer | null, team: 'home' | 'away' | null) => {
    if (!pendingEvent) return;
    
    await fetch(`/api/v1/events/${eventId}/matches/${matchId}/referee/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      body: JSON.stringify({
        id: generateUUID(),
        event_type: pendingEvent.type,
        period: getPeriod(),
        elapsed_seconds: elapsed,
        display_minute: Math.floor(elapsed / 60),
        display_second: elapsed % 60,
        event_player_id: playerOut ? playerOut.id : undefined,
        event_registration_id: playerOut ? playerOut.registration_id : undefined,
        metadata: {
          player_in_id: playerIn ? playerIn.id : null,
          player_in_name: playerIn ? playerIn.name : null,
          player_out_name: playerOut ? playerOut.name : null,
        }
      })
    });

    setPendingEvent(null);
  };

  const confirmFoul = async (playerCommitting: MatchPlayer | null, playerReceiving: MatchPlayer | null, team: 'home' | 'away' | null, penaltyAwarded?: boolean) => {
    if (!pendingEvent) return;
    
    await fetch(`/api/v1/events/${eventId}/matches/${matchId}/referee/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      body: JSON.stringify({
        id: generateUUID(),
        event_type: pendingEvent.type,
        period: getPeriod(),
        elapsed_seconds: elapsed,
        display_minute: Math.floor(elapsed / 60),
        display_second: elapsed % 60,
        event_player_id: playerCommitting ? playerCommitting.id : undefined,
        event_registration_id: playerCommitting ? playerCommitting.registration_id : undefined,
        metadata: {
          received_by_player_id: playerReceiving ? playerReceiving.id : null,
          received_by_registration_id: playerReceiving ? playerReceiving.registration_id : null,
          received_by_player_name: playerReceiving ? playerReceiving.name : null,
          committed_by_player_name: playerCommitting ? playerCommitting.name : null,
          penaltyAwarded: penaltyAwarded || undefined,
        }
      })
    });

    setPendingEvent(null);
  };

  if (isAuthorized === null) return <div className="p-12 text-center">Verifying Referee Assignment...</div>;
  if (isAuthorized === false) return (
    <div className="p-12 text-center text-red-600">
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p>You have not been assigned as a referee for this match.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 dark:bg-zinc-900/50 p-4">
      <div className="text-center py-6">
        <h1 className="text-4xl font-mono font-bold">{formatClock()}</h1>
        <p className="text-slate-500 dark:text-zinc-400 font-semibold mt-2">{matchState}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-8">
        {matchState === 'FULL_TIME' || matchState === 'COMPLETED' ? (
          <div className="col-span-2 text-center p-6 bg-slate-200 rounded-xl">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-200">MATCH ENDED</h2>
            <p className="text-slate-500 dark:text-zinc-400 mt-2">No further referee actions allowed.</p>
            {matchState === 'FULL_TIME' ? (
              <button 
                onClick={() => changeState('COMPLETED' as MatchState)}
                className="mt-6 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
              >
                CONFIRM & COMPLETE MATCH
              </button>
            ) : (
              <p className="mt-6 font-bold text-green-700">MATCH OFFICIALLY COMPLETED</p>
            )}
          </div>
        ) : (
          <>
            <button 
              onClick={() => changeState('PAUSED' as MatchState)} 
              disabled={!['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'].includes(matchState)} 
              className={`py-4 rounded-xl font-bold ${['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'].includes(matchState) ? 'bg-amber-50 dark:bg-amber-950/300 text-white hover:bg-amber-600' : 'bg-slate-300 text-slate-500 dark:text-zinc-400 cursor-not-allowed opacity-50'}`}>
              PAUSE
            </button>
            
            <button 
              onClick={() => {
                if (matchState === 'HALF_TIME') return changeState('SECOND_HALF' as MatchState);
                if (matchState === 'EXTRA_TIME_BREAK') return changeState('EXTRA_TIME_2' as MatchState);
                if (matchState === 'PAUSED') return changeState(previousActiveState);
                return changeState('LIVE' as MatchState);
              }} 
              disabled={['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'].includes(matchState)} 
              className={`py-4 rounded-xl font-bold ${!['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'].includes(matchState) ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-300 text-slate-500 dark:text-zinc-400 cursor-not-allowed opacity-50'}`}>
              {matchState === 'HALF_TIME' ? 'START 2ND HALF' : (matchState === 'SCHEDULED' ? 'START MATCH' : 'RESUME')}
            </button>
            
            <button 
              onClick={() => { if (isHalfTimeAllowed() && matchState !== 'HALF_TIME' && matchState !== 'SECOND_HALF') changeState('HALF_TIME' as MatchState); }}
              className={`py-4 rounded-xl font-bold ${(isHalfTimeAllowed() && matchState !== 'HALF_TIME' && matchState !== 'SECOND_HALF') ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-300 text-slate-500 dark:text-zinc-400 cursor-not-allowed opacity-50'}`}
            >
              HALF TIME
            </button>
            
            <button 
              onClick={() => { if (isFullTimeAllowed()) changeState('FULL_TIME' as MatchState); }}
              className={`py-4 rounded-xl font-bold ${isFullTimeAllowed() ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-300 text-slate-500 dark:text-zinc-400 cursor-not-allowed opacity-50'}`}
            >
              FULL TIME
            </button>
          </>
        )}
      </div>

      <MatchAuditLog eventId={eventId} matchId={matchId} eventType="referee" />

      {matchState !== 'FULL_TIME' && matchState !== 'COMPLETED' && (
        <div className="grid grid-cols-3 gap-2 mt-auto pb-8">
          <button onClick={() => handleEventClick('FOUL' as RefereeEventType)} className="bg-slate-200 text-slate-800 dark:text-zinc-200 py-3 rounded-lg font-bold">FOUL</button>
          <button onClick={() => handleEventClick('YELLOW_CARD' as RefereeEventType)} className="bg-yellow-400 text-slate-900 dark:text-zinc-100 py-3 rounded-lg font-bold">YELLOW</button>
          <button onClick={() => handleEventClick('RED_CARD' as RefereeEventType)} className="bg-red-600 text-white py-3 rounded-lg font-bold">RED</button>
          <button onClick={() => handleEventClick('SUBSTITUTION' as RefereeEventType)} className="col-span-3 bg-blue-600 text-white py-3 rounded-lg font-bold">SUBSTITUTION</button>
        </div>
      )}

      {pendingEvent && pendingEvent.type === 'SUBSTITUTION' ? (
        <SubstitutionModal
          players={players}
          playersLoading={playersLoading}
          onClose={() => setPendingEvent(null)}
          onConfirm={confirmSubstitution}
        />
      ) : pendingEvent && pendingEvent.type === 'FOUL' ? (
        <FoulModal
          players={players}
          playersLoading={playersLoading}
          onClose={() => setPendingEvent(null)}
          onConfirm={confirmFoul}
        />
      ) : pendingEvent ? (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-lg">Select Player</h3>
              <button onClick={() => setPendingEvent(null)} className="text-slate-400 hover:text-slate-600 dark:text-zinc-400 text-2xl leading-none">&times;</button>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1">
              {playersLoading ? (
                <div className="text-center py-8 text-slate-500 dark:text-zinc-400">Loading players...</div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-sm text-slate-400 mb-2 uppercase tracking-wider">Home Team</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {players.home.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).map(p => (
                        <button key={p.id} onClick={() => confirmEvent(p)} className="flex items-center text-left bg-slate-50 dark:bg-zinc-900/50 p-2 rounded hover:bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
                          <span className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded text-slate-700 dark:text-zinc-300 font-bold mr-3">{p.jersey_number || '-'}</span>
                          <span className="font-medium">{p.name}</span>
                        </button>
                      ))}
                      {players.home.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).length === 0 && <p className="text-sm text-slate-400">No active players found</p>}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-sm text-slate-400 mb-2 uppercase tracking-wider">Away Team</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {players.away.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).map(p => (
                        <button key={p.id} onClick={() => confirmEvent(p)} className="flex items-center text-left bg-slate-50 dark:bg-zinc-900/50 p-2 rounded hover:bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
                          <span className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded text-slate-700 dark:text-zinc-300 font-bold mr-3">{p.jersey_number || '-'}</span>
                          <span className="font-medium">{p.name}</span>
                        </button>
                      ))}
                      {players.away.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).length === 0 && <p className="text-sm text-slate-400">No active players found</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-slate-50 dark:bg-zinc-900/50">
              <button onClick={() => confirmEvent(null)} className="w-full py-2 bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold rounded-lg hover:bg-slate-300">
                Skip / Unknown Player
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
