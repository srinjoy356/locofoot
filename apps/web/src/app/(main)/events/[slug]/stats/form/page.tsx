import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Activity } from 'lucide-react';

export default async function TournamentFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { slug } = await params;
  
  let eventId = slug;
  let eventData = null;
  if (slug.length < 30) {
    const { data } = await supabase.from('events').select('id, name').eq('slug', slug).maybeSingle();
    if (!data) notFound();
    eventId = data.id;
    eventData = data;
  } else {
    const { data } = await supabase.from('events').select('id, name').eq('id', slug).maybeSingle();
    if (!data) notFound();
    eventData = data;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const [playerFormRes, teamFormRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/statistics/player-form/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/team-form/${eventId}`, { next: { revalidate: 60 } })
  ]);

  const playerForm = playerFormRes.ok ? await playerFormRes.json() : [];
  const teamForm = teamFormRes.ok ? await teamFormRes.json() : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div>
         <Link href={`/events/${slug}/stats`} className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 w-fit mb-4">
            ← Back to Overview
         </Link>
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-locofoot-500/20 flex items-center justify-center">
             <Activity className="w-5 h-5 text-locofoot-400" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-white tracking-tight">Form Hub</h1>
             <p className="text-sm text-zinc-400">{eventData.name}</p>
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/20">
            <h3 className="font-semibold text-white">Player Form (Top 20)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 font-medium">Player</th>
                  <th className="px-4 py-2 text-right text-zinc-500 font-medium">MP (L5)</th>
                  <th className="px-4 py-2 text-right text-zinc-500 font-medium">Avg Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {playerForm.length > 0 ? playerForm.slice(0, 20).map((p: any) => (
                  <tr key={p.event_player_id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-2">
                      <div className="font-medium text-white">{p.player_name || 'Unknown'}</div>
                      <div className="text-xs text-zinc-500">{p.team_name}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-400 font-mono">{p.matches_played}</td>
                    <td className="px-4 py-2 text-right text-locofoot-400 font-bold font-mono">
                      {p.avg_rating ? p.avg_rating.toFixed(2) : '-'}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-500">Insufficient tracked data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/20">
            <h3 className="font-semibold text-white">Team Form</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 font-medium">Team</th>
                  <th className="px-4 py-2 text-left text-zinc-500 font-medium">Last 5</th>
                  <th className="px-4 py-2 text-right text-zinc-500 font-medium">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {teamForm.length > 0 ? teamForm.map((t: any) => (
                  <tr key={t.team_id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-2">
                      <Link href={`/events/${slug}/teams/${t.team_id}`} className="font-medium text-white hover:text-locofoot-400">
                        {t.team_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex space-x-1">
                        {t.last_5_results && t.last_5_results.map((res: string, i: number) => (
                          <span key={i} className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-sm ${
                            res === 'W' ? 'bg-locofoot-500/20 text-locofoot-400' :
                            res === 'D' ? 'bg-zinc-700/50 text-zinc-400' :
                            'bg-red-50 dark:bg-red-950/200/20 text-red-400'
                          }`}>
                            {res}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-white font-bold font-mono">
                      {t.last_5_points}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-500">Insufficient tracked data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
