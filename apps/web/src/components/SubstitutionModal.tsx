import React, { useState } from 'react';
import { MatchPlayer } from '@/app/(admin)/admin/events/[eventId]/matches/[matchId]/useMatchPlayers';

interface SubstitutionModalProps {
  players: { home: MatchPlayer[]; away: MatchPlayer[] };
  playersLoading: boolean;
  onClose: () => void;
  onConfirm: (playerOut: MatchPlayer | null, playerIn: MatchPlayer | null, team: 'home' | 'away' | null) => void;
}

export function SubstitutionModal({ players, playersLoading, onClose, onConfirm }: SubstitutionModalProps) {
  const [team, setTeam] = useState<'home' | 'away' | null>(null);
  const [playerOut, setPlayerOut] = useState<MatchPlayer | null>(null);
  const [playerIn, setPlayerIn] = useState<MatchPlayer | null>(null);
  const [step, setStep] = useState<'TEAM' | 'OUT' | 'IN'>('TEAM');

  const handleSelectTeam = (t: 'home' | 'away') => {
    setTeam(t);
    setStep('OUT');
  };

  const handleSelectOut = (p: MatchPlayer) => {
    setPlayerOut(p);
    setStep('IN');
  };

  const handleSelectIn = (p: MatchPlayer) => {
    setPlayerIn(p);
  };

  const activePlayers = team === 'home' ? players.home : players.away;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md sm:rounded-xl rounded-t-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-3 border-b flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">SUBSTITUTION</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-zinc-400 text-2xl leading-none px-2">&times;</button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto p-4 flex-1 bg-white dark:bg-zinc-900 space-y-4">
          
          {/* Step 1: Team */}
          <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-100">
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200 mb-3">1. Select Team</h3>
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

          {/* Step 2: Player Out */}
          {team && (
            <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">2. Player OFF (Out)</h3>
                {playerOut && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">{playerOut.name}</span>}
              </div>
              {!playerOut && (
                playersLoading ? <div className="text-xs text-slate-400">Loading...</div> : (
                  <div className="flex overflow-x-auto pb-2 gap-2 snap-x">
                    {activePlayers.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).map(p => (
                      <button key={p.id} onClick={() => handleSelectOut(p)} className="snap-start flex-none flex flex-col items-center bg-white dark:bg-zinc-900 p-2 rounded w-16 hover:bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
                        <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 font-bold mb-1 shadow-sm text-sm">{p.jersey_number || '-'}</span>
                        <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">{p.name}</span>
                      </button>
                    ))}
                    {activePlayers.filter(p => !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus || '')).length === 0 && <p className="text-xs text-slate-400">No active players</p>}
                  </div>
                )
              )}
              {playerOut && (
                <button onClick={() => { setPlayerOut(null); setPlayerIn(null); setStep('OUT'); }} className="text-xs text-blue-600 font-semibold underline">Change Player OFF</button>
              )}
            </div>
          )}

          {/* Step 3: Player In */}
          {playerOut && (
            <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">3. Player ON (In)</h3>
                {playerIn && <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">{playerIn.name}</span>}
              </div>
              {!playerIn && (
                playersLoading ? <div className="text-xs text-slate-400">Loading...</div> : (
                  <div className="flex overflow-x-auto pb-2 gap-2 snap-x">
                    {activePlayers.filter(p => p.id !== playerOut.id && ['SUBSTITUTE', null].includes(p.participationStatus as any)).map(p => (
                      <button key={p.id} onClick={() => handleSelectIn(p)} className="snap-start flex-none flex flex-col items-center bg-white dark:bg-zinc-900 p-2 rounded w-16 hover:bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
                        <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 font-bold mb-1 shadow-sm text-sm">{p.jersey_number || '-'}</span>
                        <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">{p.name}</span>
                      </button>
                    ))}
                    {activePlayers.filter(p => p.id !== playerOut.id && ['SUBSTITUTE', null].includes(p.participationStatus as any)).length === 0 && <p className="text-xs text-slate-400">No available substitutes</p>}
                  </div>
                )
              )}
              {playerIn && (
                <button onClick={() => setPlayerIn(null)} className="text-xs text-blue-600 font-semibold underline">Change Player ON</button>
              )}
            </div>
          )}

        </div>
        
        {/* Footer Actions */}
        <div className="p-3 border-t bg-white dark:bg-zinc-900 shrink-0">
          <button 
            disabled={!playerOut || !playerIn}
            onClick={() => onConfirm(playerOut, playerIn, team)} 
            className={`w-full py-3 font-bold rounded-lg shadow-sm ${(!playerOut || !playerIn) ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            Confirm Substitution
          </button>
        </div>
      </div>
    </div>
  );
}
