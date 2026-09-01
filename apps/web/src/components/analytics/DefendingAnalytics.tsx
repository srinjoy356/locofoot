'use client';
import React from 'react';
import Link from 'next/link';

export function DefendingAnalytics({ players, teams, eventSlug }: { players: any[], teams: any[], eventSlug: string }) {
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
        title="Top Tacklers"
        columns={["Player", "Tackles", "Attempted", "Success %"]}
        data={[...players].sort((a, b) => b.tackles - a.tackles).slice(0, 10).filter(p => p.tackles > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.tackles}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.tackles_attempted}</td>
            <td className="px-4 py-2 text-right text-locofoot-400 font-mono">
              {p.tackles_attempted > 0 ? ((p.tackles / p.tackles_attempted) * 100).toFixed(1) + '%' : '-'}
            </td>
          </tr>
        )}
      />

      <StatTable 
        title="Interceptions"
        columns={["Player", "MP", "Interceptions"]}
        data={[...players].sort((a, b) => b.interceptions - a.interceptions).slice(0, 10).filter(p => p.interceptions > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.matches_played}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.interceptions}</td>
          </tr>
        )}
      />
      
      <StatTable 
        title="Recoveries & Clearances"
        columns={["Player", "Recoveries", "Clearances", "Blocks"]}
        data={[...players].sort((a, b) => (b.recoveries + b.clearances) - (a.recoveries + a.clearances)).slice(0, 10).filter(p => (p.recoveries + p.clearances) > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.recoveries}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.clearances}</td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.blocks}</td>
          </tr>
        )}
      />
      
      <StatTable 
        title="Aerial Duels Won"
        columns={["Player", "MP", "Aerials Won"]}
        data={[...players].sort((a, b) => b.aerials_won - a.aerials_won).slice(0, 10).filter(p => p.aerials_won > 0)}
        renderRow={(p: any) => (
          <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
            <td className="px-4 py-2">
              <Link href={`/players/${p.player_unique_code}`} className="font-medium text-white hover:text-locofoot-400">
                {p.player_name}
              </Link>
              <div className="text-xs text-zinc-500">{p.team_name}</div>
            </td>
            <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.matches_played}</td>
            <td className="px-4 py-2 text-right text-white font-bold font-mono">{p.aerials_won}</td>
          </tr>
        )}
      />
    </div>
  );
}
