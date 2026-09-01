'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TimelineEventType, MatchPeriod } from '@locofoot/shared-types';
import { useMatchClock } from '../useMatchClock';
import { useMatchPlayers, MatchPlayer } from '../useMatchPlayers';
import { MatchAuditLog } from '@/components/MatchAuditLog';
import { DetailedEventModal } from '@/components/DetailedEventModal';

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
  const [pendingEvent, setPendingEvent] = useState<{ type: TimelineEventType, extra: any } | null>(null);
  const [attackingDirection, setAttackingDirection] = useState<'home_up' | 'home_down'>('home_up');

  const { elapsed, formatClock, matchState, getPeriod } = useMatchClock(eventId, matchId);
  const { players, teams, loading: playersLoading } = useMatchPlayers(matchId);

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

  const handleEventClick = (type: TimelineEventType, extraMetadata: any = {}) => {
    if (isMatchEnded) return;
    setPendingEvent({ type, extra: extraMetadata });
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

    await fetch(`/api/v1/events/${eventId}/matches/${matchId}/timeline/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      body: JSON.stringify({
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
        metadata: cleanMetadata
      })
    });

    setPendingEvent(null);
    setCoordinates(null);
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-50 p-4">
      <div className="text-center py-4 border-b flex justify-between items-center">
        <h1 className="text-xl font-bold">Event Recorder</h1>
        <div className="text-lg font-mono font-bold text-slate-800">{formatClock()}</div>
      </div>

      <div className="flex justify-between items-center mt-4 px-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase leading-tight">
          <div><span className="text-slate-800">{teams.homeName}</span>: {attackingDirection === 'home_up' ? 'TOP' : 'BOTTOM'}</div>
          <div><span className="text-slate-800">{teams.awayName}</span>: {attackingDirection === 'home_up' ? 'BOTTOM' : 'TOP'}</div>
        </div>
        <button 
          onClick={toggleDirection} 
          className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded font-bold transition-colors shadow-sm"
        >
          Flip Sides
        </button>
      </div>

      {/* Interactive Pitch */}
      <div 
        ref={pitchRef}
        onClick={handlePitchClick}
        className={`aspect-[2/3] bg-emerald-700 w-full max-h-[50vh] rounded-lg mt-2 border-2 border-white relative shadow-inner overflow-hidden cursor-crosshair shrink-0 transition-transform duration-500 ${attackingDirection === 'home_down' ? 'rotate-180' : ''}`}
      >
        <div className="absolute top-0 w-full h-1/2 border-b-2 border-white/50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-white/50" />
        <div className={`absolute inset-0 flex items-center justify-center text-white/30 font-bold pointer-events-none transition-transform duration-500 ${attackingDirection === 'home_down' ? '-rotate-180' : ''}`}>TAP TO SET LOCATION</div>
        
        {coordinates && (
          <div 
            className="absolute w-4 h-4 bg-yellow-400 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow"
            style={{ left: `${coordinates.x}%`, top: `${coordinates.y}%` }}
          />
        )}
      </div>
      
      {!coordinates && <p className="text-center text-sm text-slate-500 mt-2 font-medium">Tap the pitch first, then select an event.</p>}

      <div className={`grid grid-cols-2 gap-2 mt-4 pb-4 ${isMatchEnded ? 'opacity-50 pointer-events-none' : ''}`}>
        <button onClick={() => handleEventClick('SHOT' as TimelineEventType, { result: 'GOAL' })} className="bg-emerald-500 text-white py-3 rounded-lg font-bold shadow">GOAL</button>
        <button onClick={() => handleEventClick('SHOT' as TimelineEventType)} className="bg-slate-800 text-white py-3 rounded-lg font-bold shadow">SHOT</button>
        <button onClick={() => handleEventClick('PASS' as TimelineEventType, { result: 'COMPLETED' })} className="bg-blue-500 text-white py-3 rounded-lg font-bold shadow">PASS</button>
        <button onClick={() => handleEventClick('DRIBBLE' as TimelineEventType, { result: 'SUCCESS' })} className="bg-purple-500 text-white py-3 rounded-lg font-bold shadow">DRIBBLE</button>
        <button onClick={() => handleEventClick('TACKLE' as TimelineEventType, { result: 'WON_RETAINED' })} className="bg-amber-600 text-white py-3 rounded-lg font-bold shadow">TACKLE</button>
        <button onClick={() => handleEventClick('INTERCEPTION' as TimelineEventType)} className="bg-cyan-600 text-white py-3 rounded-lg font-bold shadow">INTERCEPT</button>
        <button onClick={() => handleEventClick('CLEARANCE' as TimelineEventType)} className="bg-orange-500 text-white py-3 rounded-lg font-bold shadow">CLEAR</button>
        <button onClick={() => handleEventClick('AERIAL_DUEL' as TimelineEventType, { result: 'WON' })} className="bg-lime-600 text-white py-3 rounded-lg font-bold shadow">AERIAL WON</button>
        <button onClick={() => handleEventClick('SAVE' as TimelineEventType)} className="bg-indigo-500 text-white py-3 rounded-lg font-bold shadow">SAVE</button>
        <button onClick={() => handleEventClick('FOUL' as TimelineEventType)} className="bg-rose-500 text-white py-3 rounded-lg font-bold shadow">FOUL</button>
        
        <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleEventClick('YELLOW_CARD' as TimelineEventType)} className="bg-yellow-400 text-yellow-900 py-3 rounded-lg font-bold shadow">YEL CARD</button>
            <button onClick={() => handleEventClick('RED_CARD' as TimelineEventType)} className="bg-red-600 text-white py-3 rounded-lg font-bold shadow">RED CARD</button>
        </div>
        <button onClick={() => handleEventClick('BALL_RECOVERY' as TimelineEventType)} className="bg-teal-600 text-white py-3 rounded-lg font-bold shadow">RECOVERY</button>
        <button onClick={() => handleEventClick('CROSS' as TimelineEventType)} className="bg-sky-500 text-white py-3 rounded-lg font-bold shadow">CROSS</button>
      </div>

      {pendingEvent && (
        <DetailedEventModal 
          eventType={pendingEvent.type}
          players={players}
          playersLoading={playersLoading}
          onClose={() => setPendingEvent(null)}
          onConfirm={confirmDetailedEvent}
        />
      )}

      <MatchAuditLog matchId={matchId} eventId={eventId} eventType="timeline" />
    </div>
  );
}
