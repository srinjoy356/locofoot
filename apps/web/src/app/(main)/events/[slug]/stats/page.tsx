import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { Card, CardContent } from '@/components/ui/card';

export default async function TournamentStatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { slug } = await params;
  
  let eventId = slug;
  let eventData = null;
  if (slug.length < 30) {
    const { data } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
    if (!data) notFound();
    eventId = data.id;
    eventData = data;
  } else {
    const { data } = await supabase.from('events').select('*').eq('id', slug).maybeSingle();
    if (!data) notFound();
    eventData = data;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  // Fetch all tournament data in parallel
  const [
    kpisRes,
    standingsRes,
    teamFormRes,
    goalsRes,
    assistsRes
  ] = await Promise.all([
    fetch(`${apiUrl}/api/v1/statistics/tournament-kpis/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/standings/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/team-form/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/leaderboards/golden-boot?event_id=${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/leaderboards/playmaker?event_id=${eventId}`, { next: { revalidate: 60 } })
  ]);

  const kpis = kpisRes.ok ? await kpisRes.json() : null;
  const standings = standingsRes.ok ? await standingsRes.json() : [];
  const teamForm = teamFormRes.ok ? await teamFormRes.json() : [];
  const goals = goalsRes.ok ? (await goalsRes.json()).data : [];
  const assists = assistsRes.ok ? (await assistsRes.json()).data : [];

  // Map team form to standings
  const teamFormMap: Record<string, string[]> = {};
  teamForm.forEach((f: any) => {
    teamFormMap[f.team_id] = f.form_last_5;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-10 p-4 text-zinc-100">
      {/* HEADER */}
      <div>
        <h1 className="text-4xl font-black mb-2">{eventData.name} Statistics</h1>
        {eventData.format && <div className="text-zinc-400 text-sm font-medium">{eventData.format} Format</div>}
        <div className="border-b border-zinc-800 pb-2 flex gap-6 px-2 mt-8 overflow-x-auto">
          <Link href={`/events/${slug}/stats`} className="font-bold border-b-2 border-white pb-2 text-white whitespace-nowrap">Overview</Link>
          <Link href={`/events/${slug}/stats/players`} className="font-medium pb-2 text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap">Players</Link>
          <Link href={`/events/${slug}/stats/teams`} className="font-medium pb-2 text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap">Teams</Link>
          <Link href={`/events/${slug}/stats/analytics`} className="font-medium pb-2 text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap">Analytics</Link>
          <Link href={`/events/${slug}/stats/form`} className="font-medium pb-2 text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap">Form</Link>
          <Link href={`/events/${slug}/stats/advanced`} className="font-medium pb-2 text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap">Advanced</Link>
          <Link href={`/events/${slug}/stats/granular`} className="font-medium pb-2 text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap flex items-center gap-1">Granular <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">NEW</span></Link>
        </div>
      </div>

      {/* KPIS */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href={`/events/${slug}/schedule`} className="block group">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center group-hover:bg-zinc-800 transition-colors h-full">
               <div className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-2">Matches</div>
               <div className="text-4xl font-black text-zinc-100">{kpis.matches_played}</div>
            </div>
          </Link>
          <Link href={`/events/${slug}/stats/goals`} className="block group">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center group-hover:bg-zinc-800 transition-colors h-full">
               <div className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-2">Goals</div>
               <div className="text-4xl font-black text-zinc-100">{kpis.total_goals}</div>
            </div>
          </Link>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center h-full">
             <div className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-2">Goals/Match</div>
             <div className="text-4xl font-black text-zinc-100">{kpis.goals_per_match}</div>
          </div>
          <Link href={`/events/${slug}/stats/cards`} className="block group">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center group-hover:bg-zinc-800 transition-colors h-full">
               <div className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-2">Yellow Cards</div>
               <div className="text-4xl font-black text-yellow-500">{kpis.yellow_cards}</div>
            </div>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* STANDINGS (2 columns wide on XL) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="bg-zinc-800/50 p-4 font-bold text-sm uppercase tracking-wider text-zinc-400">Standings</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900/50 text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="p-4 font-semibold w-10 text-center">#</th>
                    <th className="p-4 font-semibold">Team</th>
                    <th className="p-4 font-semibold text-center w-12">MP</th>
                    <th className="p-4 font-semibold text-center w-12">W</th>
                    <th className="p-4 font-semibold text-center w-12">D</th>
                    <th className="p-4 font-semibold text-center w-12">L</th>
                    <th className="p-4 font-semibold text-center w-12">GF</th>
                    <th className="p-4 font-semibold text-center w-12">GA</th>
                    <th className="p-4 font-semibold text-center w-12">GD</th>
                    <th className="p-4 font-black text-center text-white w-12">Pts</th>
                    <th className="p-4 font-semibold text-center w-32">Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {standings.map((t: any, idx: number) => {
                    const form = teamFormMap[t.team_registration_id] || teamFormMap[t.team_id] || [];
                    return (
                      <tr key={t.team_registration_id || t.team_id} className="hover:bg-zinc-800/30">
                        <td className="p-4 text-center text-zinc-500 font-bold">{idx + 1}</td>
                        <td className="p-4 font-bold text-zinc-100">
                          {t.team_registration_id ? (
                             <Link href={`/events/${slug}/teams/${t.team_registration_id}`} className="hover:underline">{t.team_name}</Link>
                          ) : t.team_name}
                        </td>
                        <td className="p-4 text-center text-zinc-400">{t.matches_played}</td>
                        <td className="p-4 text-center text-zinc-300">{t.wins || 0}</td>
                        <td className="p-4 text-center text-zinc-300">{t.draws || 0}</td>
                        <td className="p-4 text-center text-zinc-300">{t.losses || 0}</td>
                        <td className="p-4 text-center text-zinc-300">{t.goals_for || 0}</td>
                        <td className="p-4 text-center text-zinc-300">{t.goals_against || 0}</td>
                        <td className="p-4 text-center font-semibold">{t.goal_difference > 0 ? `+${t.goal_difference}` : t.goal_difference}</td>
                        <td className="p-4 text-center font-black text-lg text-white">{t.points}</td>
                        <td className="p-4">
                           <div className="flex gap-1 justify-center">
                             {form.length === 0 ? (
                               <span className="text-zinc-600 text-xs">-</span>
                             ) : (
                               form.map((res: string, i: number) => (
                                 <div key={i} className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-black ${
                                   res === 'W' ? 'bg-green-600 text-white' : 
                                   res === 'D' ? 'bg-zinc-500 text-white' : 
                                   res === 'L' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-transparent'
                                 }`}>
                                   {res}
                                 </div>
                               ))
                             )}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                  {standings.length === 0 && (
                    <tr><td colSpan={11} className="p-8 text-center text-zinc-500">No standings data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* LEADERBOARDS (1 column wide on XL) */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-1">
             <LeaderboardTable 
               title="Top Scorers" 
               metricLabel="Goals" 
               data={goals.slice(0, 5)} 
               loading={false} 
               viewAllHref={`/events/${slug}/stats/goals`}
               eventSlug={slug}
             />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-1">
             <LeaderboardTable 
               title="Top Assists" 
               metricLabel="Assists" 
               data={assists.slice(0, 5)} 
               loading={false} 
               viewAllHref={`/events/${slug}/stats/assists`}
               eventSlug={slug}
             />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Link href={`/events/${slug}/stats/goal-contributions`} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-zinc-800 transition-colors text-center text-sm font-bold text-zinc-300">
              <span className="text-[#ccff00] text-xl block mb-1">G+A</span>
              Goal Contribs
            </Link>
            <Link href={`/events/${slug}/stats/tackles`} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-zinc-800 transition-colors text-center text-sm font-bold text-zinc-300">
              <span className="text-zinc-500 text-xl block mb-1">⚔️</span>
              Tackles
            </Link>
            <Link href={`/events/${slug}/stats/interceptions`} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-zinc-800 transition-colors text-center text-sm font-bold text-zinc-300">
              <span className="text-zinc-500 text-xl block mb-1">🛡️</span>
              Interceptions
            </Link>
            <Link href={`/events/${slug}/stats/saves`} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-zinc-800 transition-colors text-center text-sm font-bold text-zinc-300">
              <span className="text-zinc-500 text-xl block mb-1">🧤</span>
              Saves
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
