"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Trophy, User, Calendar, MapPin, Activity } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";

interface EventItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  date: string;
  teamsCount: number;
}

interface PlayerItem {
  id: string;
  uniqueCode: string;
  name: string;
  avatar: string | null;
}

export default function ExploreClient({ 
  initialEvents, 
  initialPlayers 
}: { 
  initialEvents: EventItem[]; 
  initialPlayers: PlayerItem[];
}) {
  const [tab, setTab] = useState<"events" | "players">("events");
  const [search, setSearch] = useState("");

  const filteredEvents = initialEvents.filter(e => 
    (e.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (e.slug || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredPlayers = initialPlayers.filter(p => 
    (p.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (p.uniqueCode || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border dark:border-zinc-800">
        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg w-full sm:w-auto">
          <button 
            onClick={() => setTab("events")}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md transition-all ${tab === "events" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"}`}
          >
            Events
          </button>
          <button 
            onClick={() => setTab("players")}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md transition-all ${tab === "players" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"}`}
          >
            Players
          </button>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-zinc-200"
          />
        </div>
      </div>

      {tab === "events" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 dark:text-zinc-400">
              No events found.
            </div>
          ) : (
            filteredEvents.map(event => (
              <Link href={`/events/${event.slug || event.id}`} key={event.id} className="group block bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-800 relative">
                  {event.status === 'LIVE' && (
                    <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                      <Activity size={12} className="animate-pulse" /> LIVE
                    </div>
                  )}
                </div>
                <div className="p-5 relative">
                  <div className="absolute -top-10 left-5 bg-white dark:bg-zinc-800 p-3 rounded-xl shadow-sm border dark:border-zinc-700">
                    <Trophy className="text-yellow-500" size={24} />
                  </div>
                  <h3 className="text-xl font-bold mt-4 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">{event.name}</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-500 dark:text-zinc-400">
                    <div className="flex items-center gap-2"><Calendar size={14} /> {format(new Date(event.date), 'MMM d, yyyy')}</div>
                    <div className="flex items-center gap-2"><User size={14} /> {event.teamsCount} Teams</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === "players" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPlayers.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 dark:text-zinc-400">
              No players found.
            </div>
          ) : (
            filteredPlayers.map(player => (
              <Link href={`/players/${player.uniqueCode}`} key={player.id} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-xl flex flex-col items-center text-center hover:shadow-md transition-shadow group">
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-zinc-800 mb-4 overflow-hidden relative border-2 border-transparent group-hover:border-blue-500 transition-colors">
                  {player.avatar ? (
                    <Image src={player.avatar} alt={player.name} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-light">
                      {player.name ? player.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors line-clamp-1 w-full">{player.name}</h3>
                <p className="text-xs font-mono text-slate-400 dark:text-zinc-500 mt-1">{player.uniqueCode}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
