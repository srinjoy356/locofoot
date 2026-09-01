'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';

type SortKey = 'player_name' | 'team_name' | 'matches_played' | 'goals' | 'assists' | 'goal_contributions' | 'tackles' | 'interceptions' | 'average_rating';
type SortDir = 'asc' | 'desc';

export function PlayersClientTable({ players, eventSlug }: { players: any[], eventSlug: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('goals');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = players.filter(p => p.player_name.toLowerCase().includes(search.toLowerCase()) || p.team_name.toLowerCase().includes(search.toLowerCase()));
  
  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const currentItems = sorted.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
          placeholder="Search players or teams..." 
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50 border-b border-zinc-800">
            <tr>
              <Th label="Player" column="player_name" />
              <Th label="Team" column="team_name" />
              <Th label="MP" column="matches_played" />
              <Th label="G" column="goals" />
              <Th label="A" column="assists" />
              <Th label="G+A" column="goal_contributions" />
              <Th label="Tckl" column="tackles" />
              <Th label="Int" column="interceptions" />
              <Th label="Rating" column="average_rating" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {currentItems.map((p) => (
              <tr key={p.event_player_id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/players/${p.player_unique_code}`} className="text-white hover:text-locofoot-400 transition-colors">
                    {p.player_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/events/${eventSlug}/teams/${p.team_registration_id}`} className="text-zinc-300 hover:text-zinc-100">
                    {p.team_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400 font-mono">{p.matches_played}</td>
                <td className="px-4 py-3 text-white font-mono">{p.goals}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono">{p.assists}</td>
                <td className="px-4 py-3 text-zinc-300 font-bold font-mono">{p.goal_contributions}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono">{p.tackles}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono">{p.interceptions}</td>
                <td className="px-4 py-3 font-mono font-medium text-locofoot-400">
                  {p.average_rating ? p.average_rating.toFixed(1) : '-'}
                </td>
              </tr>
            ))}
            {currentItems.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                  {players.length === 0 ? "Insufficient tracked data for this tournament." : "No matching players found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button 
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button 
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
