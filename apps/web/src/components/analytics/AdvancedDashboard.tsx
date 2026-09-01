'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface AdvancedDashboardProps {
  clutch: any[];
  comebacks: any[];
  records: any;
  trends: any[];
  eventSlug: string;
}

export function AdvancedDashboard({ clutch, comebacks, records, trends, eventSlug }: AdvancedDashboardProps) {
  const [activeTab, setActiveTab] = useState<'clutch' | 'comebacks' | 'records' | 'trends'>('clutch');

  return (
    <div className="space-y-6">
      {/* TABS */}
      <div className="flex bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800">
        <button 
          onClick={() => setActiveTab('clutch')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'clutch' ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
        >
          Clutch Performers
        </button>
        <button 
          onClick={() => setActiveTab('comebacks')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'comebacks' ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
        >
          Comeback Kings
        </button>
        <button 
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'records' ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
        >
          Tournament Records
        </button>
        <button 
          onClick={() => setActiveTab('trends')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'trends' ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
        >
          Goals Timeline
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-6 shadow-xl">
        
        {/* CLUTCH TAB */}
        {activeTab === 'clutch' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-white mb-6">Clutch Performance Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900/50 text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="p-4 font-semibold w-12 text-center">#</th>
                    <th className="p-4 font-semibold">Player</th>
                    <th className="p-4 font-semibold">Team</th>
                    <th className="p-4 font-semibold text-center w-24 text-orange-400">GWG</th>
                    <th className="p-4 font-semibold text-center w-24">Equalizers</th>
                    <th className="p-4 font-semibold text-center w-24">Late Goals (80'+)</th>
                    <th className="p-4 font-semibold text-center w-24">Total Goals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {clutch.length > 0 ? clutch.map((p, idx) => (
                    <tr key={p.event_player_id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-4 text-center text-zinc-500 font-bold">{idx + 1}</td>
                      <td className="p-4 font-bold text-zinc-100">
                        <Link href={`/events/${eventSlug}/players/${p.event_player_id}`} className="hover:underline hover:text-orange-400">
                          {p.player_name}
                        </Link>
                      </td>
                      <td className="p-4 text-zinc-400">{p.team_name}</td>
                      <td className="p-4 text-center font-black text-orange-500 text-lg">{p.gwg}</td>
                      <td className="p-4 text-center text-zinc-300 font-semibold">{p.equalizers}</td>
                      <td className="p-4 text-center text-zinc-300 font-semibold">{p.late_goals}</td>
                      <td className="p-4 text-center text-zinc-500">{p.total_goals}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-zinc-500 font-medium">Insufficient clutch data. Play more matches!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500 mt-4 px-4">* GWG (Game Winning Goal): The goal that definitively put the winning team ahead for the final time.</p>
          </div>
        )}

        {/* COMEBACKS TAB */}
        {activeTab === 'comebacks' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-white mb-6">Comeback Kings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900/50 text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="p-4 font-semibold w-12 text-center">#</th>
                    <th className="p-4 font-semibold">Team</th>
                    <th className="p-4 font-semibold text-center w-32 text-orange-400">Comeback Wins</th>
                    <th className="p-4 font-semibold text-center w-32">Comeback Draws</th>
                    <th className="p-4 font-semibold text-center w-32">Times Fell Behind</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {comebacks.length > 0 ? comebacks.map((team, idx) => (
                    <tr key={team.team_id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-4 text-center text-zinc-500 font-bold">{idx + 1}</td>
                      <td className="p-4 font-bold text-zinc-100">
                        <Link href={`/events/${eventSlug}/teams/${team.team_id}`} className="hover:underline hover:text-orange-400">
                          {team.team_name}
                        </Link>
                      </td>
                      <td className="p-4 text-center font-black text-orange-500 text-lg">{team.comeback_wins}</td>
                      <td className="p-4 text-center text-zinc-300 font-semibold">{team.comeback_draws}</td>
                      <td className="p-4 text-center text-zinc-500">{team.times_fell_behind}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-zinc-500 font-medium">No comebacks recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500 mt-4 px-4">* Comeback: Achieved when a team falls behind on the scoreboard but manages to secure a win or a draw.</p>
          </div>
        )}

        {/* RECORDS TAB */}
        {activeTab === 'records' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-white">Tournament Extremes</h2>
            
            {records && (records.highest_scoring_match > 0 || records.biggest_win_margin > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-zinc-950/50 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Highest Scoring Match</div>
                  <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">
                    {records.highest_scoring_match}
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">Total Goals</div>
                </div>

                <div className="bg-zinc-950/50 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Biggest Win Margin</div>
                  <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">
                    +{records.biggest_win_margin}
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">Goal Difference</div>
                </div>

                <div className="bg-zinc-950/50 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Most Goals By A Team</div>
                  <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">
                    {records.most_goals_by_one_team}
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">In a single match</div>
                </div>

                <div className="bg-zinc-950/50 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Highest Scoring Draw</div>
                  <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">
                    {records.highest_scoring_draw}
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">Total Goals</div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-zinc-500 font-medium bg-zinc-950/50 border border-zinc-800 rounded-2xl">
                Tournament records will generate here once matches are completed.
              </div>
            )}
          </div>
        )}

        {/* TRENDS TAB */}
        {activeTab === 'trends' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-white">Goals Over Time</h2>
            
            {trends.length > 0 ? (
              <div className="w-full mt-10 px-4">
                <div className="flex items-end h-64 gap-2 w-full justify-between">
                  {trends.map((t, i) => {
                    // Find max goals to scale the bars
                    const maxGoals = Math.max(...trends.map(tr => tr.total_goals));
                    const heightPercent = maxGoals > 0 ? (t.total_goals / maxGoals) * 100 : 0;
                    
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 group">
                        <div className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold bg-zinc-800 text-white px-2 py-1 rounded">
                          {t.total_goals} Goals
                        </div>
                        <div 
                          className="w-full max-w-[40px] bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-sm transition-all duration-700 ease-out"
                          style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                        />
                        <div className="mt-4 text-[10px] text-zinc-500 uppercase font-semibold text-center whitespace-nowrap rotate-[-45deg] origin-top-left translate-y-2">
                          {new Date(t.match_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="h-16"></div> {/* Spacer for rotated labels */}
              </div>
            ) : (
              <div className="p-12 text-center text-zinc-500 font-medium bg-zinc-950/50 border border-zinc-800 rounded-2xl">
                Match trends will appear as the tournament progresses.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
