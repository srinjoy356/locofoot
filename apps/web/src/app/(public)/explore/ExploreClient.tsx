"use client";

import { useState } from "react";
import Link from "next/link";
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
    <div className="flex flex-col w-full h-full">
      {/* Hero Section */}
      <section className="relative w-full h-[60vh] min-h-[400px] border-b border-outline-variant bg-[#151816]">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10"></div>
          <img 
            alt="Desaturated turf with high contrast stadium lighting" 
            className="w-full h-full object-cover filter grayscale opacity-60 mix-blend-luminosity" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBq6MHWzgiDcohCBMsTTmBd0H6IXmdFKDM5MNCZkru7fqm4hj9BQwGA4Lbc-Y6GAOaWXvqrsH1Oat43fINVvi97atTHJbqf0cb4IRzlKFD-1x3P9I8SdB7A1HpHXKzICgCO6jx1-bDKhgybkfMIQKmtceUoRMhFYy-j2L3yhV1DcUtdbh0QAwZ30TAIFYAirKeW6JQcwcB1i_o8rs6Rgh7GrZsz9YuQorl6fN-aiYhwH4-IDd6_NWmgsA0d255hUpeYFQ"
          />
        </div>
        
        {/* Hero Content */}
        <div className="relative z-20 h-full flex flex-col justify-center px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full">
          <h1 className="font-display-lg text-display-lg text-on-surface max-w-2xl uppercase tracking-tighter leading-none">
            Find your next <span className="text-primary-container">match.</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-4 max-w-xl">
            Real-time turf availability, elite match making, and performance tracking across urban arenas.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input 
                type="text" 
                placeholder={`Search ${tab}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface-container border border-outline-variant rounded-none text-on-surface focus:outline-none focus:border-primary-container transition-colors"
              />
            </div>
            <div className="flex bg-surface-container border border-outline-variant rounded-none">
              <button 
                onClick={() => setTab("events")}
                className={`flex-1 sm:flex-none px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest transition-colors ${tab === "events" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"}`}
              >
                Events
              </button>
              <button 
                onClick={() => setTab("players")}
                className={`flex-1 sm:flex-none px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest transition-colors ${tab === "players" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"}`}
              >
                Players
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live Ticker */}
      <div className="w-full bg-[#151816] border-b border-outline-variant py-2 overflow-hidden flex items-center px-margin-mobile md:px-gutter shrink-0">
        <div className="flex items-center gap-2 mr-6 shrink-0">
          <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]"></div>
          <span className="font-label-caps text-label-caps text-primary-container uppercase">Live Now</span>
        </div>
        <div className="flex gap-6 overflow-x-auto whitespace-nowrap no-scrollbar pb-1">
          {/* Mock Ticker Items for flavor */}
          <div className="flex items-center gap-3 border-r border-outline-variant pr-6">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Arena A</span>
            <span className="font-mono text-sm uppercase">FC Blitz <span className="text-primary-container font-bold tabular-nums">2 - 1</span> Titans</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px]">78'</span>
          </div>
          <div className="flex items-center gap-3 border-r border-outline-variant pr-6">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Arena B</span>
            <span className="font-mono text-sm uppercase">Vanguard <span className="text-primary-container font-bold tabular-nums">0 - 0</span> Apex</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px]">12'</span>
          </div>
          <div className="flex items-center gap-3 border-r border-outline-variant pr-6">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Arena C</span>
            <span className="font-mono text-sm uppercase">Night Hawks <span className="text-primary-container font-bold tabular-nums">3 - 3</span> Rovers</span>
            <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px]">HT</span>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <section className="py-16 px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface uppercase tracking-tighter">
              {tab === 'events' ? 'Upcoming Matches' : 'Elite Athletes'}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {tab === 'events' ? 'Join open slots or spectate elite fixtures.' : 'Discover players and track their stats.'}
            </p>
          </div>
        </div>

        {tab === "events" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 px-gutter relative overflow-hidden opacity-50">
                <div className="relative z-10 text-center">
                  <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">sports_soccer</span>
                  <h3 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface-variant uppercase tracking-widest">No events found</h3>
                </div>
              </div>
            ) : (
              filteredEvents.map(event => (
                <Link href={`/events/${event.slug || event.id}`} key={event.id} className="bg-[#151816] border border-outline-variant p-6 flex flex-col hover:border-primary-container transition-colors group rounded-none">
                  <div className="flex justify-between items-start mb-6">
                    <div className="bg-surface border border-outline-variant px-2 py-1 rounded-none">
                      <span className="font-label-caps text-label-caps text-on-surface uppercase tabular-nums">{format(new Date(event.date), 'MMM d • HH:mm')}</span>
                    </div>
                    {event.status === 'LIVE' ? (
                      <span className="font-label-caps text-label-caps text-primary-container border border-primary-container/30 bg-primary-container/10 px-2 py-1 uppercase">LIVE</span>
                    ) : (
                      <span className="font-label-caps text-label-caps text-on-surface-variant border border-outline-variant px-2 py-1 uppercase">{event.status}</span>
                    )}
                  </div>
                  <h3 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface uppercase mb-2 group-hover:text-primary-container transition-colors line-clamp-2">{event.name}</h3>
                  
                  <div className="mt-auto pt-6 border-t border-outline-variant flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">TEAMS</span>
                      <span className="font-mono text-sm text-on-surface tabular-nums">{event.teamsCount}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase">ACTION</span>
                      <span className="font-label-caps text-label-caps text-primary-container uppercase group-hover:underline">VIEW &rarr;</span>
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
              <div className="col-span-full flex flex-col items-center justify-center py-20 px-gutter relative overflow-hidden opacity-50">
                <div className="relative z-10 text-center">
                  <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">person</span>
                  <h3 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface-variant uppercase tracking-widest">No players found</h3>
                </div>
              </div>
            ) : (
              filteredPlayers.map(player => (
                <Link href={`/players/${player.uniqueCode}`} key={player.id} className="bg-[#151816] border border-outline-variant p-6 flex flex-col items-center text-center hover:border-primary-container transition-colors group rounded-none">
                  <div className="w-20 h-20 rounded-none bg-surface-variant mb-4 overflow-hidden relative border border-outline-variant group-hover:border-primary-container transition-colors">
                    {player.avatar ? (
                      <img src={player.avatar} alt={player.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-2xl font-black font-display-sm uppercase">
                        {player.name ? player.name.charAt(0) : '?'}
                      </div>
                    )}
                  </div>
                  <h3 className="font-headline-lg-mobile text-lg text-on-surface uppercase group-hover:text-primary-container transition-colors line-clamp-1 w-full">{player.name}</h3>
                  <p className="text-xs font-mono text-on-surface-variant mt-1 uppercase tracking-widest">{player.uniqueCode}</p>
                </Link>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
