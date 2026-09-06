'use client';

import React, { useState } from 'react';
import { AnimatedPitch } from './AnimatedPitch';

type InteractiveMatchTimelineProps = {
  timeline: any[];
  matchData: any;
  playerNames: Record<string, string>;
};

export function InteractiveMatchTimeline({ timeline, matchData, playerNames }: InteractiveMatchTimelineProps) {
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const handleEventClick = (e: any, index: number) => {
    setActiveIndex(index);
    
    // Map timeline event to PitchEvent format
    const isHome = e.actor_registration_id === matchData.home_registration_id || e.event_registration_id === matchData.home_registration_id;
    const actorId = e.actor_player_id || e.event_player_id;
    const actorName = playerNames[actorId] || 'Unknown';
    const targetId = e.target_player_id || e.metadata?.player_in_id;
    const targetName = targetId ? playerNames[targetId] : 'Unknown';
    
    setActiveEvent({
      id: e.id || `${e.event_type}-${e.elapsed_seconds}`,
      type: e.event_type,
      actor: {
        id: actorId,
        name: actorName,
        team: isHome ? 'home' : 'away',
      },
      target: {
        id: targetId,
        name: targetName,
      },
      minute: e.display_minute
    });
  };

  return (
    <div className="bg-surface-container border border-outline-variant overflow-hidden flex flex-col h-full">
      <div className="bg-surface-container-high p-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant shrink-0">
        Key Moments
      </div>
      
      {/* Animated Pitch Section */}
      <div className="p-4 bg-surface border-b border-outline-variant shrink-0 relative">
         <AnimatedPitch activeEvent={activeEvent} />
         {timeline.length > 0 && activeIndex === -1 && (
           <div className="absolute inset-0 bg-surface/50 backdrop-blur-[2px] flex items-center justify-center pointer-events-none z-50">
             <div className="bg-surface-container-high px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-outline-variant">
               Click an event to animate
             </div>
           </div>
         )}
      </div>

      {/* Timeline List Section */}
      <div className="p-4 space-y-3 overflow-y-auto max-h-[500px]">
        {timeline.length === 0 ? (
          <div className="text-sm text-on-surface-variant text-center p-4">No key events recorded.</div>
        ) : (
          timeline.map((e, i) => {
            const isHome = e.actor_registration_id === matchData.home_registration_id || e.event_registration_id === matchData.home_registration_id;
            const name = playerNames[e.actor_player_id || e.event_player_id] || 'Unknown Player';
            let icon = '⏱️';
            if (e.event_type === 'SHOT' || e.event_type === 'GOAL') icon = '⚽';
            if (e.event_type === 'YELLOW_CARD') icon = '🟨';
            if (e.event_type === 'RED_CARD') icon = '🟥';
            if (e.event_type === 'SUBSTITUTION') icon = '🔄';
            
            const isActive = i === activeIndex;

            return (
              <button 
                key={i} 
                onClick={() => handleEventClick(e, i)}
                className={`w-full flex gap-3 text-sm items-center transition-colors rounded-lg p-2 ${
                  isHome ? 'flex-row' : 'flex-row-reverse'
                } ${
                  isActive ? 'bg-primary-container/20 ring-1 ring-primary-container' : 'hover:bg-surface-variant'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isActive ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface'
                }`}>
                  {e.display_minute}'
                </div>
                <div className={`px-3 py-2 flex items-center gap-2 rounded-lg flex-1 ${isHome ? 'justify-start text-left' : 'justify-end text-right'} ${
                  isActive ? 'bg-primary-container/10' : 'bg-surface-variant/50'
                }`}>
                  {isHome && <span>{icon}</span>}
                  <span className={`font-semibold ${isActive ? 'text-primary' : 'text-on-surface'}`}>{name}</span>
                  {!isHome && <span>{icon}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
