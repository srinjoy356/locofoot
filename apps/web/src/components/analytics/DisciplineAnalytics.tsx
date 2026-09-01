'use client';
import React from 'react';
import Link from 'next/link';

export function DisciplineAnalytics({ players, teams, eventSlug }: { players: any[], teams: any[], eventSlug: string }) {
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
        title="Fouls Committed"
        columns={["Player", "MP", "Fouls", "F/M"]}
        data={[...players].sort((a, b) => b.fouls_committed - a.fouls_committed).slice(0, 10).filter(p => p.fouls_committed > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.matches_played}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.fouls_committed}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">
              {p.matches_played > 0 ? (p.fouls_committed / p.matches_played).toFixed(1) : '0.0'}
            </td>
          </tr>
        )}
      />

      <StatTable 
        title="Fouls Drawn (Foul Magnet)"
        columns={["Player", "MP", "Fouls Drawn"]}
        data={[...players].sort((a, b) => b.fouls_drawn - a.fouls_drawn).slice(0, 10).filter(p => p.fouls_drawn > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.matches_played}</td>
            <td className="px-4 py-2 text-right text-locofoot-400 font-bold font-mono">{p.fouls_drawn}</td>
          </tr>
        )}
      />

      <StatTable 
        title="Card Magnet (Cards Received)"
        columns={["Player", "Yellow", "Red", "Total Cards"]}
        data={[...players].filter(p => p.yellow_cards > 0 || p.red_cards > 0).sort((a, b) => (b.yellow_cards + b.red_cards * 2) - (a.yellow_cards + a.red_cards * 2)).slice(0, 10)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-yellow-500 font-bold font-mono">{p.yellow_cards}</td>
            <td className="px-4 py-2 text-right text-red-500 font-bold font-mono">{p.red_cards}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.yellow_cards + p.red_cards}</td>
          </tr>
        )}
      />
    </div>
  );
}
