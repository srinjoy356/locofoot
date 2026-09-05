'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MatchState, RefereeEventType, MatchPeriod } from '@locofoot/shared-types';
import { useMatchClock } from '../useMatchClock';
import { useMatchPlayers, MatchPlayer } from '../useMatchPlayers';
import { MatchAuditLog } from '@/components/MatchAuditLog';
import { SubstitutionModal } from '@/components/SubstitutionModal';
import { FoulModal } from '@/components/FoulModal';
import { RefereeLineupManager } from '@/components/RefereeLineupManager';

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

  const handleForfeit = async (team: 'home' | 'away') => {
    if (!confirm(`Are you sure you want to declare a forfeit for the ${team.toUpperCase()} team? The match will end immediately, and the other team will be awarded a 3-0 win.`)) return;

    try {
      const res = await fetch(`/api/v1/events/${eventId}/matches/${matchId}/referee/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ idempotency_key: generateUUID(), forfeiting_team: team, reason: `${team.toUpperCase()} team No Show` })
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

  if (isAuthorized === null) return <div className="p-12 text-center text-on-surface-variant bg-background min-h-screen font-label-caps text-label-caps uppercase tracking-widest">Verifying Referee Assignment...</div>;
  if (isAuthorized === false) return (
    <div className="p-12 text-center bg-background min-h-screen">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-error">Access Denied</h1>
      <p className="text-on-surface-variant font-body-md mt-2">You have not been assigned as a referee for this match.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background text-on-surface p-4">
      {/* Themed turf header bar */}
      <div className="relative overflow-hidden border border-outline-variant bg-[#151816] shrink-0">
        <div className="absolute inset-0 z-0">
          <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-25 " src="/turf/turf-closeup.jpg" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30 z-10" />
        </div>
        <div className="relative z-20 text-center py-5">
          <span className="flex items-center justify-center gap-2 mb-2 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]" />
            Referee Control
          </span>
          <h1 className="text-4xl font-mono font-bold text-primary-container tabular-nums tracking-tighter">{formatClock()}</h1>
          <p className="text-on-surface-variant font-label-caps text-label-caps uppercase tracking-widest mt-2">{matchState}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-8">
        {matchState === 'FULL_TIME' || matchState === 'COMPLETED' ? (
          <div className="col-span-2 text-center p-6 bg-surface-container border border-outline-variant">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface">MATCH ENDED</h2>
            <p className="text-on-surface-variant font-body-md mt-2">No further referee actions allowed.</p>
            {matchState === 'FULL_TIME' ? (
              <button
                onClick={() => changeState('COMPLETED' as MatchState)}
                className="mt-6 w-full py-3 bg-primary-container text-on-primary-container font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors"
              >
                CONFIRM & COMPLETE MATCH
              </button>
            ) : (
              <p className="mt-6 font-label-caps text-label-caps uppercase tracking-widest text-primary-container">MATCH OFFICIALLY COMPLETED</p>
            )}
          </div>
        ) : (
          <>
            {matchState === 'SCHEDULED' && (
              <div className="col-span-2 mb-2">
                <RefereeLineupManager eventId={eventId} matchId={matchId} />
              </div>
            )}

            <button
              onClick={() => changeState('PAUSED' as MatchState)}
              disabled={!['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'].includes(matchState)}
              className={`py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors ${['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'].includes(matchState) ? 'border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-variant' : 'border border-outline-variant bg-surface text-on-surface-variant cursor-not-allowed opacity-40'}`}>
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
              className={`py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors ${!['LIVE', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'].includes(matchState) ? 'bg-primary-container text-on-primary-container hover:bg-primary-fixed' : 'border border-outline-variant bg-surface text-on-surface-variant cursor-not-allowed opacity-40'}`}>
              {matchState === 'HALF_TIME' ? 'START 2ND HALF' : (matchState === 'SCHEDULED' ? 'START MATCH' : 'RESUME')}
            </button>

            <button
              onClick={() => { if (isHalfTimeAllowed() && matchState !== 'HALF_TIME' && matchState !== 'SECOND_HALF') changeState('HALF_TIME' as MatchState); }}
              className={`py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors ${(isHalfTimeAllowed() && matchState !== 'HALF_TIME' && matchState !== 'SECOND_HALF') ? 'border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-variant' : 'border border-outline-variant bg-surface text-on-surface-variant cursor-not-allowed opacity-40'}`}
            >
              HALF TIME
            </button>

            <button
              onClick={() => { if (isFullTimeAllowed()) changeState('FULL_TIME' as MatchState); }}
              className={`py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors ${isFullTimeAllowed() ? 'bg-on-surface text-surface hover:bg-on-surface-variant' : 'border border-outline-variant bg-surface text-on-surface-variant cursor-not-allowed opacity-40'}`}
            >
              FULL TIME
            </button>

            {matchState === 'SCHEDULED' && (
              <div className="col-span-2 grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-outline-variant">
                <button
                  onClick={() => handleForfeit('home')}
                  className="py-3 border border-error text-error hover:bg-error/10 font-label-caps text-label-caps uppercase tracking-widest transition-colors"
                >
                  Home No-Show (Forfeit)
                </button>
                <button
                  onClick={() => handleForfeit('away')}
                  className="py-3 border border-error text-error hover:bg-error/10 font-label-caps text-label-caps uppercase tracking-widest transition-colors"
                >
                  Away No-Show (Forfeit)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <MatchAuditLog eventId={eventId} matchId={matchId} eventType="referee" />

      {matchState !== 'FULL_TIME' && matchState !== 'COMPLETED' && (
        <div className="grid grid-cols-3 gap-2 mt-auto pb-8">
          <button onClick={() => handleEventClick('FOUL' as RefereeEventType)} className="border border-outline-variant bg-surface text-on-surface hover:bg-surface-variant py-3 font-label-caps text-label-caps uppercase tracking-widest transition-colors">FOUL</button>
          <button onClick={() => handleEventClick('YELLOW_CARD' as RefereeEventType)} className="bg-yellow-400 text-background py-3 font-label-caps text-label-caps uppercase tracking-widest">YELLOW</button>
          <button onClick={() => handleEventClick('RED_CARD' as RefereeEventType)} className="bg-error text-on-error py-3 font-label-caps text-label-caps uppercase tracking-widest">RED</button>
          <button onClick={() => handleEventClick('SUBSTITUTION' as RefereeEventType)} className="col-span-3 border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-variant py-3 font-label-caps text-label-caps uppercase tracking-widest transition-colors">SUBSTITUTION</button>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface">
              <h3 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface">Select Player</h3>
              <button onClick={() => setPendingEvent(null)} className="text-on-surface-variant hover:text-on-surface text-2xl leading-none">&times;</button>
            </div>

            <div className="overflow-y-auto p-4 flex-1">
              {playersLoading ? (
                <div className="text-center py-8 text-on-surface-variant font-label-caps text-label-caps uppercase tracking-widest">Loading players...</div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase tracking-widest">Home Team</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {(() => {
                        const hasLineup = players.home.some(p => p.participationStatus !== null);
                        const filtered = players.home.filter(p => hasLineup ? ['STARTER', 'SUBBED_IN'].includes(p.participationStatus as any) : !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus as any));
                        if (filtered.length === 0) return <p className="text-sm text-on-surface-variant">No active players found</p>;
                        return filtered.map(p => (
                          <button key={p.id} onClick={() => confirmEvent(p)} className="flex flex-col items-center bg-surface p-2 hover:bg-surface-variant border border-outline-variant transition-colors">
                            <span className="w-8 h-8 flex items-center justify-center bg-surface-variant border border-outline-variant text-on-surface font-mono font-bold mb-1 tabular-nums">{p.jersey_number || '-'}</span>
                            <span className="text-[10px] text-center font-medium truncate w-full text-on-surface">{p.name}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase tracking-widest">Away Team</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {(() => {
                        const hasLineup = players.away.some(p => p.participationStatus !== null);
                        const filtered = players.away.filter(p => hasLineup ? ['STARTER', 'SUBBED_IN'].includes(p.participationStatus as any) : !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus as any));
                        if (filtered.length === 0) return <p className="text-sm text-on-surface-variant">No active players found</p>;
                        return filtered.map(p => (
                          <button key={p.id} onClick={() => confirmEvent(p)} className="flex flex-col items-center bg-surface p-2 hover:bg-surface-variant border border-outline-variant transition-colors">
                            <span className="w-8 h-8 flex items-center justify-center bg-surface-variant border border-outline-variant text-on-surface font-mono font-bold mb-1 tabular-nums">{p.jersey_number || '-'}</span>
                            <span className="text-[10px] text-center font-medium truncate w-full text-on-surface">{p.name}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-outline-variant bg-surface">
              <button onClick={() => confirmEvent(null)} className="w-full py-2 border border-outline-variant bg-surface text-on-surface font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">
                Skip / Unknown Player
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
