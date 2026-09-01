'use client';
import React from 'react';
import Link from 'next/link';

export function PlaymakingAnalytics({ players, teams, eventSlug }: { players: any[], teams: any[], eventSlug: string }) {
  const topAssists = [...players].sort((a, b) => b.assists - a.assists).slice(0, 10);
  
  const topPassers = [...players]
    .filter(p => p.passes_attempted >= 10)
    .map(p => ({ ...p, accuracy: (p.passes_completed / p.passes_attempted) * 100 }))
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 10);

  const topKeyPassers = [...players].sort((a, b) => b.key_passes - a.key_passes).slice(0, 10);

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
        title="Top Assists"
        columns={["Player", "MP", "Assists"]}
        data={topAssists.filter(p => p.assists > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.matches_played}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.assists}</td>
          </tr>
        )}
      />

      <StatTable 
        title="Key Passes"
        columns={["Player", "Key Passes", "Through Balls"]}
        data={topKeyPassers.filter(p => p.key_passes > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.key_passes}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.through_balls}</td>
          </tr>
        )}
      />

      <StatTable 
        title="Pass Accuracy (Min 10 passes)"
        columns={["Player", "Comp", "Att", "Accuracy"]}
        data={topPassers}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.passes_completed}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.passes_attempted}</td>
            <td className="px-4 py-2 text-right text-locofoot-400 font-bold font-mono">{p.accuracy.toFixed(1)}%</td>
          </tr>
        )}
      />
      
      <StatTable 
        title="Chance Creation"
        columns={["Player", "Assists", "Crosses", "Dribbles"]}
        data={[...players].sort((a, b) => (b.assists + b.crosses + b.successful_dribbles) - (a.assists + a.crosses + a.successful_dribbles)).slice(0, 10).filter(p => (p.assists + p.crosses + p.successful_dribbles) > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.assists}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.crosses}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.successful_dribbles}</td>
          </tr>
        )}
      />
    </div>
  );
}
