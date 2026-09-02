import React, { useState } from 'react';
import { MatchPlayer } from '@/app/(admin)/admin/events/[eventId]/matches/[matchId]/useMatchPlayers';

interface FoulModalProps {
  players: { home: MatchPlayer[]; away: MatchPlayer[] };
  playersLoading: boolean;
  onClose: () => void;
  onConfirm: (playerCommitting: MatchPlayer | null, playerReceiving: MatchPlayer | null, teamCommitting: 'home' | 'away' | null, penaltyAwarded?: boolean) => void;
}

export function FoulModal({ players, playersLoading, onClose, onConfirm }: FoulModalProps) {
  const [team, setTeam] = useState<'home' | 'away' | null>(null);
  const [playerCommitting, setPlayerCommitting] = useState<MatchPlayer | null>(null);
  const [playerReceiving, setPlayerReceiving] = useState<MatchPlayer | null | 'UNKNOWN'>(null);
  const [penaltyAwarded, setPenaltyAwarded] = useState(false);

  const handleSelectTeam = (t: 'home' | 'away') => {
    setTeam(t);
  };

  const handleSelectCommitting = (p: MatchPlayer) => {
    setPlayerCommitting(p);
  };

  const handleSelectReceiving = (p: MatchPlayer | 'UNKNOWN') => {
    setPlayerReceiving(p);
  };

  const activePlayers = team === 'home' ? players.home : players.away;
  const opposingPlayers = team === 'home' ? players.away : players.home;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md sm:rounded-xl rounded-t-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-3 border-b flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">FOUL</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-zinc-400 text-2xl leading-none px-2">&times;</button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto p-4 flex-1 bg-white dark:bg-zinc-900 space-y-4">
          
          {/* Step 1: Team */}
          <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 mb-3">1. Team Committing Foul</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleSelectTeam('home')} 
                className={`py-2 rounded font-bold text-sm border-2 ${team === 'home' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-transparent bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 shadow-sm'}`}
              >
                Home
              </button>
              <button 
                onClick={() => handleSelectTeam('away')} 
                className={`py-2 rounded font-bold text-sm border-2 ${team === 'away' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-transparent bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 shadow-sm'}`}
              >
                Away
              </button>
            </div>
          </div>

          {/* Step 2: Player Committing Foul */}
          {team && (
            <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">2. Player Committing Foul</h3>
                {playerCommitting && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">{playerCommitting.name}</span>}
              </div>
              {!playerCommitting && (
                playersLoading ? <div className="text-xs text-slate-400">Loading...</div> : (
                  <div className="flex overflow-x-auto pb-2 gap-2 snap-x">
                    {activePlayers.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).map(p => (
                      <button key={p.id} onClick={() => handleSelectCommitting(p)} className="snap-start flex-none flex flex-col items-center bg-white dark:bg-zinc-900 p-2 rounded w-16 hover:bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
                        <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 font-bold mb-1 shadow-sm text-sm">{p.jersey_number || '-'}</span>
                        <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">{p.name}</span>
                      </button>
                    ))}
                    {activePlayers.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).length === 0 && <p className="text-xs text-slate-400">No active players</p>}
                  </div>
                )
              )}
              {playerCommitting && (
                <button onClick={() => { setPlayerCommitting(null); setPlayerReceiving(null); }} className="text-xs text-blue-600 font-semibold underline">Change Player</button>
              )}
            </div>
          )}

          {/* Step 3: Player Receiving Foul */}
          {playerCommitting && (
            <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">3. Player Fouled (Receiver)</h3>
                {playerReceiving && playerReceiving !== 'UNKNOWN' && <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">{playerReceiving.name}</span>}
                {playerReceiving === 'UNKNOWN' && <span className="text-xs bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold px-2 py-0.5 rounded">Skipped</span>}
              </div>
              {!playerReceiving && (
                playersLoading ? <div className="text-xs text-slate-400">Loading...</div> : (
                  <div className="flex flex-col gap-3">
                    <div className="flex overflow-x-auto pb-2 gap-2 snap-x">
                      {opposingPlayers.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).map(p => (
                        <button key={p.id} onClick={() => handleSelectReceiving(p)} className="snap-start flex-none flex flex-col items-center bg-white dark:bg-zinc-900 p-2 rounded w-16 hover:bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
                          <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 font-bold mb-1 shadow-sm text-sm">{p.jersey_number || '-'}</span>
                          <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">{p.name}</span>
                        </button>
                      ))}
                      {opposingPlayers.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).length === 0 && <p className="text-xs text-slate-400">No active players</p>}
                    </div>
                    <button 
                      onClick={() => handleSelectReceiving('UNKNOWN')}
                      className="py-2 text-sm text-slate-600 dark:text-zinc-400 font-medium rounded border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:bg-slate-50 dark:bg-zinc-900/50"
                    >
                      Skip / Unknown
                    </button>
                  </div>
                )
              )}
              {playerReceiving && (
                <button onClick={() => setPlayerReceiving(null)} className="text-xs text-blue-600 font-semibold underline">Change Receiver</button>
              )}
            </div>
          )}

          {/* Step 4: Penalty Awarded */}
          {playerReceiving && (
            <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={penaltyAwarded}
                  onChange={(e) => setPenaltyAwarded(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 focus:ring-indigo-600"
                />
                <span className="font-bold text-sm text-slate-800 dark:text-zinc-200">
                  Resulted in a Penalty Kick?
                </span>
              </label>
              {penaltyAwarded && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-500 font-medium bg-amber-50 dark:bg-amber-900/30 p-2 rounded">
                  ⚠️ This will notify the match recorder to log the penalty kick outcome.
                </p>
              )}
            </div>
          )}

        </div>
        
        {/* Footer Actions */}
        <div className="p-3 border-t bg-white dark:bg-zinc-900 shrink-0">
          <button 
            disabled={!playerCommitting || !playerReceiving}
            onClick={() => onConfirm(playerCommitting, playerReceiving === 'UNKNOWN' ? null : playerReceiving, team, penaltyAwarded)} 
            className={`w-full py-3 font-bold rounded-lg shadow-sm ${(!playerCommitting || !playerReceiving) ? 'bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500' : 'bg-slate-800 dark:bg-zinc-100 text-white dark:text-slate-900 hover:bg-slate-900 dark:hover:bg-white'}`}
          >
            Log Foul
          </button>
        </div>
      </div>
    </div>
  );
}
