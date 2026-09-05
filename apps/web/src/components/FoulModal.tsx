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

  const activeTeamHasLineup = activePlayers.some(p => p.participationStatus !== null);
  const opposingTeamHasLineup = opposingPlayers.some(p => p.participationStatus !== null);

  const isOnPitch = (p: MatchPlayer, hasLineup: boolean) => hasLineup
    ? ['STARTER', 'SUBBED_IN'].includes(p.participationStatus as any)
    : !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus as any);

  const filteredActivePlayers = activePlayers.filter(p => isOnPitch(p, activeTeamHasLineup));
  const filteredOpposingPlayers = opposingPlayers.filter(p => isOnPitch(p, opposingTeamHasLineup));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-surface-container border border-outline-variant w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-3 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-surface-variant text-on-surface text-xs font-bold px-2 py-1">FOUL</span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-2xl leading-none px-2">&times;</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 flex-1 bg-surface-container space-y-4">

          {/* Step 1: Team */}
          <div className="bg-surface-container p-3 border border-outline-variant">
            <h3 className="font-bold text-sm text-on-surface mb-3">1. Team Committing Foul</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSelectTeam('home')}
                className={`py-2 font-bold text-sm border-2 ${team === 'home' ? 'border-primary-container bg-primary-container text-on-primary-container' : 'border-transparent bg-surface text-on-surface shadow-sm'}`}
              >
                Home
              </button>
              <button
                onClick={() => handleSelectTeam('away')}
                className={`py-2 font-bold text-sm border-2 ${team === 'away' ? 'border-primary-container bg-primary-container text-on-primary-container' : 'border-transparent bg-surface text-on-surface shadow-sm'}`}
              >
                Away
              </button>
            </div>
          </div>

          {/* Step 2: Player Committing Foul */}
          {team && (
            <div className="bg-surface-container p-3 border border-outline-variant">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-on-surface">2. Player Committing Foul</h3>
                {playerCommitting && <span className="text-xs bg-error text-on-error font-bold px-2 py-0.5">{playerCommitting.name}</span>}
              </div>
              {!playerCommitting && (
                playersLoading ? <div className="text-xs text-on-surface-variant">Loading...</div> : (
                  <div className="flex overflow-x-auto pb-2 gap-2 snap-x">
                    {filteredActivePlayers.map(p => (
                      <button key={p.id} onClick={() => handleSelectCommitting(p)} className="snap-start flex-none flex flex-col items-center bg-surface p-2 w-16 hover:bg-surface-variant border border-outline-variant">
                        <span className="w-8 h-8 flex items-center justify-center bg-surface-variant text-on-surface font-bold mb-1 shadow-sm text-sm">{p.jersey_number || '-'}</span>
                        <span className="w-full text-[10px] font-medium text-center leading-tight line-clamp-2 break-all">{p.name}</span>
                      </button>
                    ))}
                    {filteredActivePlayers.length === 0 && <p className="text-xs text-on-surface-variant">No active players</p>}
                  </div>
                )
              )}
              {playerCommitting && (
                <button onClick={() => { setPlayerCommitting(null); setPlayerReceiving(null); }} className="text-xs text-primary-container font-semibold underline">Change Player</button>
              )}
            </div>
          )}

          {/* Step 3: Player Receiving Foul */}
          {playerCommitting && (
            <div className="bg-surface-container p-3 border border-outline-variant">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-on-surface">3. Player Fouled (Receiver)</h3>
                {playerReceiving && playerReceiving !== 'UNKNOWN' && <span className="text-xs bg-primary-container text-on-primary-container font-bold px-2 py-0.5">{playerReceiving.name}</span>}
                {playerReceiving === 'UNKNOWN' && <span className="text-xs bg-surface-variant text-on-surface font-bold px-2 py-0.5">Skipped</span>}
              </div>
              {!playerReceiving && (
                playersLoading ? <div className="text-xs text-on-surface-variant">Loading...</div> : (
                  <div className="flex flex-col gap-3">
                    <div className="flex overflow-x-auto pb-2 gap-2 snap-x">
                      {filteredOpposingPlayers.map(p => (
                        <button key={p.id} onClick={() => handleSelectReceiving(p)} className="snap-start flex-none flex flex-col items-center bg-surface p-2 w-16 hover:bg-surface-variant border border-outline-variant">
                          <span className="w-8 h-8 flex items-center justify-center bg-surface-variant text-on-surface font-bold mb-1 shadow-sm text-sm">{p.jersey_number || '-'}</span>
                          <span className="w-full text-[10px] font-medium text-center leading-tight line-clamp-2 break-all">{p.name}</span>
                        </button>
                      ))}
                      {filteredOpposingPlayers.length === 0 && <p className="text-xs text-on-surface-variant">No active players</p>}
                    </div>
                    <button
                      onClick={() => handleSelectReceiving('UNKNOWN')}
                      className="py-2 text-sm text-on-surface-variant font-medium border border-outline-variant bg-surface shadow-sm hover:bg-surface-variant"
                    >
                      Skip / Unknown
                    </button>
                  </div>
                )
              )}
              {playerReceiving && (
                <button onClick={() => setPlayerReceiving(null)} className="text-xs text-primary-container font-semibold underline">Change Receiver</button>
              )}
            </div>
          )}

          {/* Step 4: Penalty Awarded */}
          {playerReceiving && (
            <div className="bg-surface-container p-3 border border-outline-variant">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={penaltyAwarded}
                  onChange={(e) => setPenaltyAwarded(e.target.checked)}
                  className="w-5 h-5 text-primary-container border-outline-variant bg-surface-variant focus:ring-primary-container"
                />
                <span className="font-bold text-sm text-on-surface">
                  Resulted in a Penalty Kick?
                </span>
              </label>
              {penaltyAwarded && (
                <p className="mt-2 text-xs text-yellow-400 font-medium bg-yellow-400/10 border border-yellow-400/30 p-2">
                  ⚠️ This will notify the match recorder to log the penalty kick outcome.
                </p>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-outline-variant bg-surface-container shrink-0">
          <button
            disabled={!playerCommitting || !playerReceiving}
            onClick={() => onConfirm(playerCommitting, playerReceiving === 'UNKNOWN' ? null : playerReceiving, team, penaltyAwarded)}
            className={`w-full py-3 font-bold shadow-sm ${(!playerCommitting || !playerReceiving) ? 'bg-surface-variant text-on-surface-variant' : 'bg-primary-container text-on-primary-container hover:bg-primary-fixed'}`}
          >
            Log Foul
          </button>
        </div>
      </div>
    </div>
  );
}
