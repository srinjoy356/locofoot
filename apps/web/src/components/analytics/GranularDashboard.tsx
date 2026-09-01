'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShotMap } from './ShotMap';

interface GranularDashboardProps {
  shotMap: any[];
  playmaking: any;
  goalkeeping: any;
  eventSlug: string;
}

export function GranularDashboard({ shotMap, playmaking, goalkeeping, eventSlug }: GranularDashboardProps) {
  const [activeTab, setActiveTab] = useState<'shot-map' | 'playmaking' | 'goalkeeping'>('shot-map');

  const renderLeaderboard = (title: string, data: any[], metric: string, format = (v: any) => v) => (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 px-2">{title}</h3>
      <div className="space-y-1">
        {data.length > 0 ? data.map((row, idx) => (
          <div key={row.event_player_id} className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-zinc-600 font-bold w-4 text-right text-xs">{idx + 1}</span>
              <div>
                <Link href={`/events/${eventSlug}/players/${row.event_player_id}`} className="font-bold text-zinc-200 hover:text-orange-400 text-sm block">
                  {row.player_name}
                </Link>
                <div className="text-xs text-zinc-500">{row.team_name}</div>
              </div>
            </div>
            <div className="font-black text-orange-500">{format(row[metric])}</div>
          </div>
        )) : (
          <div className="p-4 text-center text-zinc-500 text-sm font-medium">No data available.</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* TABS */}
      <div className="flex bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800">
        <button 
          onClick={() => setActiveTab('shot-map')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'shot-map' ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
        >
          Shot Map
        </button>
        <button 
          onClick={() => setActiveTab('playmaking')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'playmaking' ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
        >
          Advanced Playmaking
        </button>
        <button 
          onClick={() => setActiveTab('goalkeeping')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'goalkeeping' ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
        >
          Advanced Goalkeeping
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-6 shadow-xl">
        
        {/* SHOT MAP TAB */}
        {activeTab === 'shot-map' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black text-white">Tournament Shot Map</h2>
              <p className="text-zinc-400 text-sm mt-1">Spatial distribution of all recorded shots across the tournament.</p>
            </div>
            
            <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800/50">
              <ShotMap shots={shotMap} />
            </div>
          </div>
        )}

        {/* PLAYMAKING TAB */}
        {activeTab === 'playmaking' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black text-white">Advanced Playmaking</h2>
              <p className="text-zinc-400 text-sm mt-1">Granular passing and dribbling metrics.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {renderLeaderboard('Big Chances Created', playmaking.big_chances || [], 'big_chances_created')}
              {renderLeaderboard('Key Passes', playmaking.key_passes || [], 'key_passes')}
              {renderLeaderboard('Through Balls', playmaking.through_balls || [], 'through_balls')}
              {renderLeaderboard('Crosses', playmaking.crosses || [], 'crosses')}
              {renderLeaderboard('Nutmegs', playmaking.nutmegs || [], 'nutmegs')}
              {renderLeaderboard('Ankle Breakers (2+ beaten)', playmaking.ankle_breakers || [], 'ankle_breakers')}
            </div>
          </div>
        )}

        {/* GOALKEEPING TAB */}
        {activeTab === 'goalkeeping' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black text-white">Advanced Goalkeeping</h2>
              <p className="text-zinc-400 text-sm mt-1">Granular goalkeeping metrics.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {renderLeaderboard('Total Saves', goalkeeping.saves || [], 'saves')}
              {renderLeaderboard('1v1 Saves', goalkeeping.saves_1v1 || [], 'saves_1v1')}
              {renderLeaderboard('Penalty Saves', goalkeeping.penalty_saves || [], 'penalty_saves')}
              {renderLeaderboard('Aerial Claims', goalkeeping.aerial_claims || [], 'aerial_claims')}
              {renderLeaderboard('Sweeper Actions', goalkeeping.sweeper_actions || [], 'sweeper_actions')}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
