'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TimelineEventType, MatchPeriod } from '@locofoot/shared-types';
import { useMatchClock } from '../useMatchClock';
import { useMatchPlayers, MatchPlayer } from '../useMatchPlayers';
import { MatchAuditLog } from '@/components/MatchAuditLog';
import { DetailedEventModal } from '@/components/DetailedEventModal';
import { useUnresolvedPenalties } from '../useUnresolvedPenalties';
import { useEventQueue, type QueuedEvent } from '../useEventQueue';
import { useMatchAccess } from '../useMatchAccess';
import { QuickScorer, type RecordFn } from './QuickScorer';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function RecorderPage({ params }: { params: Promise<{ eventId: string, matchId: string }> }) {
  const { eventId, matchId } = React.use(params);
  const supabase = createClient();
  const pitchRef = useRef<HTMLDivElement>(null);

  const [coordinates, setCoordinates] = useState<{ x: number, y: number } | null>(null);
  const [pendingEvent, setPendingEvent] = useState<{ type: TimelineEventType, extra: any, referee_event_id?: string } | null>(null);
  const [mode, setMode] = useState<'quick' | 'detailed'>('quick');
  const [attackingDirection, setAttackingDirection] = useState<'home_up' | 'home_down'>('home_up');

  const { elapsed, formatClock, matchState, scores, getPeriod } = useMatchClock(eventId, matchId);
  const { players, teams, loading: playersLoading } = useMatchPlayers(matchId);
  const { penalties } = useUnresolvedPenalties(matchId);
  const queue = useEventQueue(eventId, matchId);
  const access = useMatchAccess(eventId, matchId, ['EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER', 'REFEREE', 'SCORER']);

  useEffect(() => {
    try { if (localStorage.getItem('rec_mode') === 'detailed') setMode('detailed'); } catch { /* default quick */ }
  }, []);
  const switchMode = (m: 'quick' | 'detailed') => { setMode(m); try { localStorage.setItem('rec_mode', m); } catch { /* ignore */ } };

  // Initialize from localStorage or fallback to defaults
  useEffect(() => {
    const saved = localStorage.getItem(`match_dir_${matchId}`);
    if (saved === 'home_up' || saved === 'home_down') {
      setAttackingDirection(saved);
    } else if (getPeriod() === 'SECOND_HALF') {
      setAttackingDirection('home_down');
    }
  }, [matchId, matchState]); // Re-run if matchState changes (e.g. half-time transition)

  const toggleDirection = () => {
    setAttackingDirection(prev => {
      const next = prev === 'home_up' ? 'home_down' : 'home_up';
      localStorage.setItem(`match_dir_${matchId}`, next);
      return next;
    });
  };

  const isMatchEnded = ['FULL_TIME', 'COMPLETED', 'ABANDONED', 'CANCELLED', 'POSTPONED'].includes(matchState);

  const handlePitchClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMatchEnded || !pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    if (attackingDirection === 'home_down') {
      x = 100 - x;
      y = 100 - y;
    }

    setCoordinates({ x, y });
  };

  const handleEventClick = (type: TimelineEventType, extraMetadata: any = {}, referee_event_id?: string) => {
    if (isMatchEnded) return;
    setPendingEvent({ type, extra: extraMetadata, referee_event_id });
  };

  const confirmDetailedEvent = async (actor: MatchPlayer | null, target: MatchPlayer | null, metadata: any) => {
    if (!pendingEvent) return;

    // Merge base metadata (e.g. { result: 'GOAL' } for the GOAL shortcut button) with detailed form metadata
    const finalMetadata = { ...pendingEvent.extra, ...metadata };

    const {
      is_big_chance,
      assist_player_id,
      second_assist_player_id,
      related_event_id,
      ...cleanMetadata
    } = finalMetadata;

    queue.submit({
      id: generateUUID(),
      event_type: pendingEvent.type,
      period: getPeriod(),
      elapsed_seconds: elapsed,
      display_minute: Math.floor(elapsed / 60),
      display_second: elapsed % 60,
      x: coordinates ? coordinates.x : 50,
      y: coordinates ? coordinates.y : 50,
      actor_player_id: actor ? actor.id : undefined,
      actor_registration_id: actor ? actor.registration_id : undefined,
      target_player_id: target ? target.id : undefined,
      target_registration_id: target ? target.registration_id : undefined,
      is_big_chance: is_big_chance === 'true' || is_big_chance === true,
      assist_player_id,
      second_assist_player_id,
      related_event_id,
      referee_event_id: pendingEvent.referee_event_id,
      metadata: cleanMetadata
    }, `${pendingEvent.type.replace(/_/g, ' ').toLowerCase()}${actor ? ' ' + actor.name : ''}`);

    setPendingEvent(null);
    setCoordinates(null);
  };

  const record: RecordFn = (type, actor, opts, label) => {
    const at = Math.max(0, elapsed - (opts.secondsAgo ?? 0)); // a back-dated or flagged moment keeps its real time
    queue.submit({
      id: generateUUID(),
      event_type: type,
      period: getPeriod(),
      elapsed_seconds: at,
      display_minute: Math.floor(at / 60),
      display_second: at % 60,
      x: opts.x,
      y: opts.y,
      actor_player_id: actor.id,
      actor_registration_id: actor.registration_id,
      target_player_id: opts.target?.id,
      target_registration_id: opts.target?.registration_id,
      assist_player_id: opts.assist?.id,
      metadata: opts.metadata || {},
    }, label);
  };

  const undoEvent = async (item: QueuedEvent) => {
    if (item.status !== 'queued') {
      // it may already be on the server: delete it there (a 404 just means it never landed)
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/v1/events/${eventId}/matches/${matchId}/timeline/event/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok && res.status !== 404) return alert('Could not undo that event. Check your connection and try again.');
    }
    queue.discard(item.id);
  };

  if (access === null) return <div className="p-12 text-center text-on-surface-variant bg-background min-h-screen font-label-caps text-label-caps uppercase tracking-widest">Verifying recorder access...</div>;
  if (access === false) return (
    <div className="p-12 text-center bg-background min-h-screen">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-error">Access Denied</h1>
      <p className="text-on-surface-variant font-body-md mt-2">Only this event's officials can record this match.</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-background text-on-surface p-4">
      {/* Themed turf header bar */}
      <div className="relative overflow-hidden border border-outline-variant bg-[#151816] shrink-0">
        <div className="absolute inset-0 z-0">
          <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-25 " src="/turf/aerial-field.jpg" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40 z-10" />
        </div>
        <div className="relative z-20 flex justify-between items-center px-4 py-4">
          <div>
            <span className="flex items-center gap-2 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]" />
              Live Recorder
            </span>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface mt-1">Event Recorder</h1>
          </div>
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-primary-container tabular-nums tracking-tighter">{formatClock()}</div>
            <div className="font-mono text-sm tabular-nums text-on-surface" aria-label="Score">{scores.home} - {scores.away}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1" role="group" aria-label="Recorder mode">
        {(['quick', 'detailed'] as const).map((m) => (
          <button key={m} onClick={() => switchMode(m)} aria-pressed={mode === m}
            className={`py-3 font-label-caps text-[11px] uppercase tracking-widest border ${mode === m ? 'border-primary-container bg-primary-container/15 text-primary-container' : 'border-outline-variant text-on-surface-variant'}`}>
            {m === 'quick' ? 'Quick scorer' : 'Pitch + details'}
          </button>
        ))}
      </div>

      {queue.signedOut && (
        <div role="alert" className="mt-3 border border-error bg-error/10 px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-error">
          Your login expired. Events are kept on this phone. <a href="/login" target="_blank" rel="noreferrer" className="underline">Sign in again</a> (new tab) and they upload automatically.
        </div>
      )}

      {mode === 'detailed' && queue.unsent > 0 && !queue.signedOut && (
        <div role="status" className="mt-3 border border-[#ffd479] bg-[#ffd479]/10 px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-[#ffd479]">
          {queue.unsent} event{queue.unsent > 1 ? 's' : ''} waiting to sync. They upload automatically when the connection is back.
        </div>
      )}

      {queue.failed > 0 && (
        <div role="alert" className="mt-3 border border-error bg-error/10 px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-error">
          {queue.failed} event{queue.failed > 1 ? 's were' : ' was'} rejected by the server and NOT saved. Retry or discard {queue.failed > 1 ? 'them' : 'it'} in the list below.
        </div>
      )}

      {mode === 'quick' && (
        <QuickScorer players={players} teams={teams} loading={playersLoading} disabled={isMatchEnded} elapsed={elapsed} record={record}
          items={queue.items} onUndo={undoEvent} onRetry={queue.retry} onDiscard={queue.discard} />
      )}

      {mode === 'detailed' && (<>
      <div className="flex justify-between items-center mt-4 px-2">
        <div className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest leading-tight">
          <div><span className="text-on-surface">{teams.homeName}</span>: {attackingDirection === 'home_up' ? 'TOP' : 'BOTTOM'}</div>
          <div><span className="text-on-surface">{teams.awayName}</span>: {attackingDirection === 'home_up' ? 'BOTTOM' : 'TOP'}</div>
        </div>
        <button
          onClick={toggleDirection}
          className="border border-outline-variant bg-surface text-on-surface hover:bg-surface-variant px-3 py-1 font-label-caps text-[10px] uppercase tracking-widest transition-colors"
        >
          Flip Sides
        </button>
      </div>

      {penalties.length > 0 && (
        <div className="mt-4 p-3 border border-error bg-error/10 flex flex-col gap-2">
          <div className="font-label-caps text-label-caps uppercase tracking-widest text-error">
            🚨 PENALTY KICK AWARDED!
          </div>
          {penalties.map(p => (
            <button
              key={p.id}
              onClick={() => handleEventClick('SHOT' as TimelineEventType, { result: 'GOAL', situation: 'PENALTY' }, p.id)}
              className="bg-error text-on-error py-2 font-label-caps text-label-caps uppercase tracking-widest w-full animate-pulse hover:bg-error/90 transition-colors"
            >
              RECORD PENALTY GOAL
            </button>
          ))}
        </div>
      )}

      {/* Interactive Pitch */}
      <div
        ref={pitchRef}
        onClick={handlePitchClick}
        className={`aspect-[2/3] bg-surface-container w-full max-h-[50vh] mt-2 border border-outline-variant relative overflow-hidden cursor-crosshair shrink-0 transition-transform duration-500 ${attackingDirection === 'home_down' ? 'rotate-180' : ''}`}
      >
        <div className="absolute top-0 w-full h-1/2 border-b border-primary-container/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-primary-container/20" />
        <div className={`absolute inset-0 flex items-center justify-center text-on-surface-variant/40 font-label-caps text-label-caps uppercase tracking-widest pointer-events-none transition-transform duration-500 ${attackingDirection === 'home_down' ? '-rotate-180' : ''}`}>TAP TO SET LOCATION</div>

        {coordinates && (
          <div
            className="absolute w-4 h-4 bg-primary-container rounded-full border-2 border-background transform -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-[0_0_8px_rgba(57,255,106,0.8)]"
            style={{ left: `${coordinates.x}%`, top: `${coordinates.y}%` }}
          />
        )}
      </div>

      {!coordinates && <p className="text-center font-label-caps text-[10px] text-on-surface-variant mt-2 uppercase tracking-widest">Tap the pitch first, then select an event.</p>}

      <div className={`grid grid-cols-2 gap-2 mt-4 pb-4 ${isMatchEnded ? 'opacity-50 pointer-events-none' : ''}`}>
        <button onClick={() => handleEventClick('SHOT' as TimelineEventType, { result: 'GOAL' })} className="bg-primary-container text-on-primary-container py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors">GOAL</button>
        <button onClick={() => handleEventClick('SHOT' as TimelineEventType)} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">SHOT</button>
        <button onClick={() => handleEventClick('PASS' as TimelineEventType, { result: 'COMPLETED' })} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">PASS</button>
        <button onClick={() => handleEventClick('DRIBBLE' as TimelineEventType, { result: 'SUCCESS' })} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">DRIBBLE</button>
        <button onClick={() => handleEventClick('TACKLE' as TimelineEventType, { result: 'WON_RETAINED' })} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">TACKLE</button>
        <button onClick={() => handleEventClick('INTERCEPTION' as TimelineEventType)} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">INTERCEPT</button>
        <button onClick={() => handleEventClick('CLEARANCE' as TimelineEventType)} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">CLEAR</button>
        <button onClick={() => handleEventClick('AERIAL_DUEL' as TimelineEventType, { result: 'WON' })} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">AERIAL WON</button>
        <button onClick={() => handleEventClick('SAVE' as TimelineEventType)} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">SAVE</button>
        <button onClick={() => handleEventClick('BALL_RECOVERY' as TimelineEventType)} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">RECOVERY</button>
        <button onClick={() => handleEventClick('GREAT_FIRST_TOUCH' as TimelineEventType)} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">GREAT 1ST TOUCH</button>
        <button onClick={() => handleEventClick('CROSS' as TimelineEventType)} className="border border-outline-variant bg-surface text-on-surface py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">CROSS</button>
      </div>

      </>)}

      {pendingEvent && (
        <DetailedEventModal
          eventType={pendingEvent.type}
          players={players}
          playersLoading={playersLoading}
          initialMetadata={pendingEvent.extra}
          onClose={() => setPendingEvent(null)}
          onConfirm={confirmDetailedEvent}
        />
      )}

      <MatchAuditLog matchId={matchId} eventId={eventId} eventType="timeline" />
    </div>
  );
}
