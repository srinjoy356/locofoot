'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';

type SortKey = 'team_name' | 'matches_played' | 'wins' | 'draws' | 'losses' | 'goals_for' | 'goals_against' | 'goal_difference' | 'points' | 'goals_per_match';
type SortDir = 'asc' | 'desc';

export function TeamsClientTable({ teams, eventSlug }: { teams: any[], eventSlug: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = teams.filter(t => t.team_name.toLowerCase().includes(search.toLowerCase()));
  
  const sorted = [...filtered].sort((a, b) => {
    // Inject calculated field
    const va = sortKey === 'goals_per_match' ? (a.matches_played > 0 ? a.goals_for / a.matches_played : 0) : a[sortKey];
    const vb = sortKey === 'goals_per_match' ? (b.matches_played > 0 ? b.goals_for / b.matches_played : 0) : b[sortKey];
    
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-locofoot-500" /> : <ArrowDown className="w-3 h-3 ml-1 text-locofoot-500" />;
  };

  const Th = ({ label, column }: { label: string, column: SortKey }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap group"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center">
        {label}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center h-full">
           <SortIcon column={column} />
        </div>
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input 
          type="text" 
          placeholder="Search teams..." 
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <Th label="Team" column="team_name" />
              <Th label="MP" column="matches_played" />
              <Th label="W" column="wins" />
              <Th label="D" column="draws" />
              <Th label="L" column="losses" />
              <Th label="GF" column="goals_for" />
              <Th label="GA" column="goals_against" />
              <Th label="GD" column="goal_difference" />
              <Th label="PTS" column="points" />
              <Th label="G/M" column="goals_per_match" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sorted.map((t) => (
              <tr key={t.team_registration_id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/events/${eventSlug}/teams/${t.team_registration_id}`} className="text-white hover:text-locofoot-400 transition-colors">
                    {t.team_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400 font-mono">{t.matches_played}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono">{t.wins}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono">{t.draws}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono">{t.losses}</td>
                <td className="px-4 py-3 text-zinc-300 font-mono">{t.goals_for}</td>
                <td className="px-4 py-3 text-zinc-300 font-mono">{t.goals_against}</td>
                <td className="px-4 py-3 text-zinc-300 font-mono">{t.goal_difference > 0 ? `+${t.goal_difference}` : t.goal_difference}</td>
                <td className="px-4 py-3 text-white font-bold font-mono">{t.points}</td>
                <td className="px-4 py-3 text-locofoot-400 font-mono">
                  {t.matches_played > 0 ? (t.goals_for / t.matches_played).toFixed(1) : '0.0'}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
                  {teams.length === 0 ? "Insufficient tracked data for this tournament." : "No matching teams found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
