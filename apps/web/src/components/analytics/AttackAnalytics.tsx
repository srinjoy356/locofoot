'use client';
import React from 'react';
import Link from 'next/link';

export function AttackAnalytics({ players, teams, eventSlug }: { players: any[], teams: any[], eventSlug: string }) {
  const topScorers = [...players].sort((a, b) => b.goals - a.goals).slice(0, 10);
  
  // Goal Efficiency: Goals / Shots (min 3 shots)
  const efficientPlayers = [...players]
    .filter(p => p.shots >= 3)
    .map(p => ({ ...p, conversion: (p.goals / p.shots) * 100 }))
    .sort((a, b) => b.conversion - a.conversion)
    .slice(0, 10);

  const teamGoals = [...teams].sort((a, b) => b.goals_for - a.goals_for).slice(0, 10);

  const StatTable = ({ title, data, columns, renderRow }: any) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/20">
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900">
            <tr>
              {columns.map((c: string, i: number) => (
                <th key={i} className={`px-4 py-2 text-zinc-500 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {data.length > 0 ? data.map(renderRow) : (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">Insufficient tracked data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <StatTable 
        title="Top Scorers"
        columns={["Player", "MP", "Goals", "Pens"]}
        data={topScorers.filter(p => p.goals > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.matches_played}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.goals}</td>
            <td className="px-4 py-2 text-right text-zinc-500 font-mono">{p.penalty_goals}</td>
          </tr>
        )}
      />

      <StatTable 
        title="Goal Efficiency (Min 3 Shots)"
        columns={["Player", "Shots", "Goals", "Conv %"]}
        data={efficientPlayers}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.shots}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.goals}</td>
            <td className="px-4 py-2 text-right text-locofoot-400 font-bold font-mono">{p.conversion.toFixed(1)}%</td>
          </tr>
        )}
      />

      <StatTable 
        title="Team Goals"
        columns={["Team", "MP", "Goals", "G/M"]}
        data={teamGoals.filter(t => t.goals_for > 0)}
        renderRow={(t: any) => (
          <tr key={t.team_registration_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/events/${eventSlug}/teams/${t.team_registration_id}`} className="font-medium text-white hover:text-locofoot-400">
                {t.team_name}
              </Link>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{t.matches_played}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{t.goals_for}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">
              {t.matches_played > 0 ? (t.goals_for / t.matches_played).toFixed(1) : '0.0'}
            </td>
          </tr>
        )}
      />
      
      <StatTable 
        title="Goal Contributions (G+A)"
        columns={["Player", "Goals", "Assists", "Total"]}
        data={[...players].sort((a, b) => b.goal_contributions - a.goal_contributions).slice(0, 10).filter(p => p.goal_contributions > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.goals}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.assists}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.goal_contributions}</td>
          </tr>
        )}
      />
    </div>
  );
}
