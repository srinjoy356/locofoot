import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { Card, CardContent } from '@/components/ui/card';
import { ExportControls } from '@/components/shared/ExportControls';

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
    <div className="w-full flex flex-col bg-background text-on-surface h-full min-h-screen">
      {/* HEADER */}
      <div className="w-full border-b border-outline-variant bg-[#0b0d0c] pt-12 pb-0 px-margin-mobile md:px-gutter print:hidden shrink-0">
        <div className="max-w-container-max mx-auto">
          <h1 className="font-display-lg text-display-lg md:text-[64px] uppercase tracking-tighter leading-none text-on-surface mb-2">{eventData.name} Statistics</h1>
          {eventData.format && <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">{eventData.format} Format</div>}
          
          <div className="flex gap-0 mt-12 overflow-x-auto no-scrollbar border-b border-outline-variant">
            <Link href={`/events/${slug}/stats`} className="px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest bg-surface-variant text-on-surface border-b-2 border-primary-container whitespace-nowrap">Overview</Link>
            <Link href={`/events/${slug}/stats/players`} className="px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors whitespace-nowrap">Players</Link>
            <Link href={`/events/${slug}/stats/teams`} className="px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors whitespace-nowrap">Teams</Link>
            <Link href={`/events/${slug}/stats/analytics`} className="px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors whitespace-nowrap">Analytics</Link>
            <Link href={`/events/${slug}/stats/form`} className="px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors whitespace-nowrap">Form</Link>
            <Link href={`/events/${slug}/stats/advanced`} className="px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors whitespace-nowrap">Advanced</Link>
            <Link href={`/events/${slug}/stats/granular`} className="px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:bg-surface hover:text-on-surface transition-colors whitespace-nowrap flex items-center gap-2">Granular <span className="bg-primary-container text-on-primary-container text-[9px] px-1.5 py-0.5 rounded-none font-black">NEW</span></Link>
          </div>
        </div>
      </div>
      
      <div className="hidden print:block mb-8 text-center border-b border-outline-variant pb-4">
        <h1 className="text-3xl font-black text-black uppercase tracking-tighter">{eventData.name} - Official Standings</h1>
        <p className="text-sm font-semibold text-gray-500 mt-1 uppercase tracking-widest">LocoFoot Tournament Export</p>
      </div>

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 flex-1 space-y-12">
        {/* KPIS */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-outline-variant bg-[#151816] print:hidden">
            <Link href={`/events/${slug}/schedule`} className="p-6 border-b border-r border-outline-variant flex flex-col items-center justify-center hover:bg-surface-variant transition-colors group">
              <div className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mb-2 group-hover:text-primary-container transition-colors">Matches</div>
              <div className="font-mono text-5xl font-black text-on-surface tabular-nums">{kpis.matches_played}</div>
            </Link>
            <Link href={`/events/${slug}/stats/goals`} className="p-6 border-b md:border-r border-outline-variant flex flex-col items-center justify-center hover:bg-surface-variant transition-colors group">
              <div className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mb-2 group-hover:text-primary-container transition-colors">Goals</div>
              <div className="font-mono text-5xl font-black text-primary-container tabular-nums">{kpis.total_goals}</div>
            </Link>
            <div className="p-6 border-b border-r md:border-b-0 border-outline-variant flex flex-col items-center justify-center bg-surface">
              <div className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">Goals/Match</div>
              <div className="font-mono text-5xl font-black text-on-surface tabular-nums">{kpis.goals_per_match}</div>
            </div>
            <Link href={`/events/${slug}/stats/cards`} className="p-6 border-outline-variant flex flex-col items-center justify-center hover:bg-surface-variant transition-colors group">
              <div className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mb-2 group-hover:text-yellow-400 transition-colors">Yellow Cards</div>
              <div className="font-mono text-5xl font-black text-yellow-400 tabular-nums">{kpis.yellow_cards}</div>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* STANDINGS (2 columns wide on XL) */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-surface border border-outline-variant overflow-hidden print:border-none print:shadow-none print:bg-white text-on-surface">
              <div className="bg-surface-variant p-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant print:bg-transparent print:text-black flex justify-between items-center border-b border-outline-variant print:border-slate-300">
                <span>Standings</span>
                <ExportControls 
                  filename={`${eventData.slug}-standings`}
                  data={standings}
                  columns={[
                    { key: 'team_name', label: 'Team' },
                    { key: 'matches_played', label: 'MP' },
                    { key: 'wins', label: 'W' },
                    { key: 'draws', label: 'D' },
                    { key: 'losses', label: 'L' },
                    { key: 'goals_for', label: 'GF' },
                    { key: 'goals_against', label: 'GA' },
                    { key: 'goal_difference', label: 'GD' },
                    { key: 'points', label: 'Pts' }
                  ]}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-background text-on-surface-variant border-b border-outline-variant print:bg-slate-100 print:text-black print:border-slate-300">
                    <tr>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest w-10 text-center">#</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest">Team</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center w-12">MP</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center w-12">W</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center w-12">D</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center w-12">L</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center w-12">GF</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center w-12">GA</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center w-12">GD</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center text-primary-container print:text-black w-12">Pts</th>
                      <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-center w-32 print:hidden">Form</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant print:divide-slate-200">
                    {standings.map((t: any, idx: number) => {
                      const form = teamFormMap[t.team_registration_id] || teamFormMap[t.team_id] || [];
                      return (
                        <tr key={t.team_registration_id || t.team_id} className="hover:bg-surface-variant transition-colors">
                          <td className="p-4 text-center text-on-surface-variant font-mono tabular-nums print:text-slate-600">{idx + 1}</td>
                          <td className="p-4 font-headline-lg-mobile text-on-surface uppercase tracking-tighter print:text-black">
                            {t.team_registration_id ? (
                               <Link href={`/events/${slug}/teams/${t.team_registration_id}`} className="hover:text-primary-container transition-colors">{t.team_name}</Link>
                            ) : t.team_name}
                          </td>
                          <td className="p-4 text-center text-on-surface-variant font-mono tabular-nums print:text-slate-700">{t.matches_played}</td>
                          <td className="p-4 text-center text-on-surface-variant font-mono tabular-nums print:text-slate-700">{t.wins || 0}</td>
                          <td className="p-4 text-center text-on-surface-variant font-mono tabular-nums print:text-slate-700">{t.draws || 0}</td>
                          <td className="p-4 text-center text-on-surface-variant font-mono tabular-nums print:text-slate-700">{t.losses || 0}</td>
                          <td className="p-4 text-center text-on-surface-variant font-mono tabular-nums print:text-slate-700">{t.goals_for || 0}</td>
                          <td className="p-4 text-center text-on-surface-variant font-mono tabular-nums print:text-slate-700">{t.goals_against || 0}</td>
                          <td className="p-4 text-center font-mono tabular-nums text-on-surface print:text-slate-700">{t.goal_difference > 0 ? `+${t.goal_difference}` : t.goal_difference}</td>
                          <td className="p-4 text-center font-mono text-xl font-bold text-primary-container tabular-nums print:text-black">{t.points}</td>
                          <td className="p-4 print:hidden">
                             <div className="flex gap-1 justify-center">
                               {form.length === 0 ? (
                                 <span className="text-on-surface-variant font-mono">-</span>
                               ) : (
                                 form.map((res: string, i: number) => (
                                   <div key={i} className={`w-5 h-5 flex items-center justify-center font-mono text-[10px] font-bold border ${
                                     res === 'W' ? 'bg-primary-container text-on-primary-container border-primary-container' : 
                                     res === 'D' ? 'bg-surface-variant text-on-surface border-outline-variant' : 
                                     res === 'L' ? 'bg-error text-on-error border-error' : 'bg-background text-transparent border-outline-variant'
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
                      <tr><td colSpan={11} className="p-8 text-center text-on-surface-variant font-label-caps uppercase tracking-widest opacity-60">No standings data available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* LEADERBOARDS (1 column wide on XL) */}
          <div className="space-y-6 print:hidden">
            <div className="border border-outline-variant bg-surface">
               <LeaderboardTable 
                 title="Top Scorers" 
                 metricLabel="Goals" 
                 data={goals.slice(0, 5)} 
                 loading={false} 
                 viewAllHref={`/events/${slug}/stats/goals`}
                 eventSlug={slug}
                 showExport={true}
                 exportFilename={`${eventData.slug}-top-scorers`}
               />
            </div>
            <div className="border border-outline-variant bg-surface">
               <LeaderboardTable 
                 title="Top Assists" 
                 metricLabel="Assists" 
                 data={assists.slice(0, 5)} 
                 loading={false} 
                 viewAllHref={`/events/${slug}/stats/assists`}
                 eventSlug={slug}
                 showExport={true}
                 exportFilename={`${eventData.slug}-top-assists`}
               />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <Link href={`/events/${slug}/stats/goal-contributions`} className="border border-outline-variant bg-surface hover:bg-surface-variant p-4 flex flex-col items-center justify-center transition-colors text-center">
                <span className="text-primary-container font-mono text-xl block mb-1">G+A</span>
                <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-widest">Goal Contribs</span>
              </Link>
              <Link href={`/events/${slug}/stats/tackles`} className="border border-outline-variant bg-surface hover:bg-surface-variant p-4 flex flex-col items-center justify-center transition-colors text-center">
                <span className="material-symbols-outlined text-on-surface-variant text-xl block mb-1">swords</span>
                <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-widest">Tackles</span>
              </Link>
              <Link href={`/events/${slug}/stats/interceptions`} className="border border-outline-variant bg-surface hover:bg-surface-variant p-4 flex flex-col items-center justify-center transition-colors text-center">
                <span className="material-symbols-outlined text-on-surface-variant text-xl block mb-1">shield</span>
                <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-widest">Interceptions</span>
              </Link>
              <Link href={`/events/${slug}/stats/saves`} className="border border-outline-variant bg-surface hover:bg-surface-variant p-4 flex flex-col items-center justify-center transition-colors text-center">
                <span className="material-symbols-outlined text-on-surface-variant text-xl block mb-1">front_hand</span>
                <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-widest">Saves</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
