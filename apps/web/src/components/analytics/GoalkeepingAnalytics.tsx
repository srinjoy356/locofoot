'use client';
import React from 'react';
import Link from 'next/link';

export function GoalkeepingAnalytics({ players, teams, eventSlug }: { players: any[], teams: any[], eventSlug: string }) {
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
        title="Top Saves"
        columns={["Player", "MP", "Saves", "Saves/M"]}
        data={[...players].sort((a, b) => b.saves - a.saves).slice(0, 10).filter(p => p.saves > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.matches_played}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.saves}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">
              {p.matches_played > 0 ? (p.saves / p.matches_played).toFixed(1) : '0.0'}
            </td>
          </tr>
        )}
      />

      <StatTable 
        title="Team Goals Against (Min 1 MP)"
        columns={["Team", "MP", "GA", "GA/M"]}
        data={[...teams].filter(t => t.matches_played > 0).sort((a, b) => a.goals_against - b.goals_against).slice(0, 10)}
        renderRow={(t: any) => (
          <tr key={t.team_registration_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/events/${eventSlug}/teams/${t.team_registration_id}`} className="font-medium text-white hover:text-locofoot-400">
                {t.team_name}
              </Link>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{t.matches_played}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{t.goals_against}</td>
            <td className="px-4 py-2 text-right text-locofoot-400 font-mono">
              {t.matches_played > 0 ? (t.goals_against / t.matches_played).toFixed(2) : '-'}
            </td>
          </tr>
        )}
      />

      <StatTable 
        title="Special Saves"
        columns={["Player", "Penalty Saves", "1v1 Saves"]}
        data={[...players].filter(p => p.penalty_saves > 0 || p.saves_1v1 > 0).sort((a, b) => (b.penalty_saves + b.saves_1v1) - (a.penalty_saves + a.saves_1v1)).slice(0, 10)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.penalty_saves}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.saves_1v1}</td>
          </tr>
        )}
      />
    </div>
  );
}
