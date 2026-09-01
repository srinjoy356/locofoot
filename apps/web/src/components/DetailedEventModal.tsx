import React, { useState } from 'react';
import { TimelineEventType } from '@locofoot/shared-types';
import { MatchPlayer } from '@/app/(admin)/admin/events/[eventId]/matches/[matchId]/useMatchPlayers';
import { eventTaxonomies, EventTaxonomy } from '@/lib/taxonomy';

interface DetailedEventModalProps {
  eventType: TimelineEventType;
  players: { home: MatchPlayer[]; away: MatchPlayer[] };
  playersLoading: boolean;
  onClose: () => void;
  onConfirm: (actor: MatchPlayer | null, target: MatchPlayer | null, metadata: any) => void;
}

const PlayerList = ({ onSelect, label, players }: { onSelect: (p: MatchPlayer | null) => void, label: string, players: { home: MatchPlayer[]; away: MatchPlayer[] } }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-bold text-xs text-slate-400 mb-2 uppercase tracking-wider">{label} - Home</h4>
      <div className="flex overflow-x-auto pb-2 gap-2 snap-x">
        {players.home.map(p => (
          <button key={p.id} onClick={() => onSelect(p)} className="snap-start flex-none flex flex-col items-center bg-slate-100 p-2 rounded w-16 hover:bg-slate-200 border border-slate-200">
            <span className="w-8 h-8 flex items-center justify-center bg-white rounded text-slate-700 font-bold mb-1 shadow-sm text-sm">{p.jersey_number || '-'}</span>
            <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
    <div>
      <h4 className="font-bold text-xs text-slate-400 mb-2 uppercase tracking-wider">{label} - Away</h4>
      <div className="flex overflow-x-auto pb-2 gap-2 snap-x">
        {players.away.map(p => (
          <button key={p.id} onClick={() => onSelect(p)} className="snap-start flex-none flex flex-col items-center bg-slate-100 p-2 rounded w-16 hover:bg-slate-200 border border-slate-200">
            <span className="w-8 h-8 flex items-center justify-center bg-white rounded text-slate-700 font-bold mb-1 shadow-sm text-sm">{p.jersey_number || '-'}</span>
            <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export function DetailedEventModal({ eventType, players, playersLoading, onClose, onConfirm }: DetailedEventModalProps) {
  const taxonomy: EventTaxonomy | undefined = eventTaxonomies[eventType];
  
  const [actor, setActor] = useState<MatchPlayer | null>(null);
  const [target, setTarget] = useState<MatchPlayer | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'ACTOR' | 'TARGET' | 'ATTRIBUTES'>(taxonomy ? 'ATTRIBUTES' : 'ACTOR');

  // Let's actually show ACTOR selection first, then ATTRIBUTES, then TARGET (if any).
  // But wait! If the user wants to go fast, they can just select an actor and hit "Quick Save".
  // Actually, let's put it all in one scrollable view.

  const handleAttributeChange = (name: string, value: string) => {
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full max-w-md sm:rounded-xl rounded-t-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-3 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">{eventType}</span>
            <h3 className="font-bold text-sm">Event Details</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none px-2">&times;</button>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 flex-1 bg-white space-y-6">
          {/* 1. Actor Selection */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm text-slate-800">1. Select Player</h3>
              {actor && <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">{actor.name}</span>}
            </div>
            {!actor ? (
              playersLoading ? <div className="text-xs text-slate-400">Loading...</div> : <PlayerList onSelect={setActor} label="Actor" players={players} />
            ) : (
              <button onClick={() => setActor(null)} className="text-xs text-blue-600 font-semibold underline">Change Player</button>
            )}
          </div>

          {/* 2. Target Selection (if applicable) */}
          {taxonomy?.hasTarget && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-slate-800">2. {taxonomy.targetLabel || 'Select Target'}</h3>
                {target && <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">{target.name}</span>}
              </div>
              {!target ? (
                playersLoading ? <div className="text-xs text-slate-400">Loading...</div> : (
                  <>
                    <PlayerList onSelect={setTarget} label="Target" players={players} />
                    <button onClick={() => setTarget(null)} className="mt-2 text-xs text-slate-500 font-semibold underline">Skip Target</button>
                  </>
                )
              ) : (
                <button onClick={() => setTarget(null)} className="text-xs text-blue-600 font-semibold underline">Change Target</button>
              )}
            </div>
          )}

          {/* 3. Detailed Attributes */}
          {taxonomy && taxonomy.fields.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">Attributes (Optional)</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                {taxonomy.fields.map(field => (
                  <div key={field.name} className={field.type === 'radio' ? "col-span-2" : "col-span-1"}>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{field.label}</label>
                    
                    {field.type === 'select' && field.options && (
                      <select 
                        value={metadata[field.name] || ''} 
                        onChange={(e) => handleAttributeChange(field.name, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">-- Select --</option>
                        {field.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}

                    {field.type === 'radio' && field.options && (
                      <div className="flex flex-wrap gap-2">
                        {field.options.map(opt => {
                          const isSelected = metadata[field.name] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => handleAttributeChange(field.name, opt.value)}
                              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        <div className="p-3 border-t bg-white shrink-0 grid grid-cols-2 gap-2">
          <button 
            onClick={() => onConfirm(actor, target, metadata)} 
            className="col-span-2 py-3 bg-slate-900 text-white font-bold rounded-lg shadow-sm hover:bg-slate-800"
          >
            Save Event
          </button>
          <button 
            onClick={() => onConfirm(null, null, {})} 
            className="col-span-2 py-2 text-slate-500 font-semibold text-xs hover:text-slate-700"
          >
            Quick Save (No details)
          </button>
        </div>
      </div>
    </div>
  );
}
