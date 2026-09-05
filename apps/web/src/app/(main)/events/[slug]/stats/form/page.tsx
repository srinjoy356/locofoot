import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TurfHero } from '@/components/shared/TurfHero';

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
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen">
      <TurfHero
        eyebrow="Momentum"
        title="Form Hub"
        subtitle={eventData.name}
        image="/turf/aerial-field.jpg"
        size="sm"
      />

      <div className="max-w-6xl mx-auto w-full space-y-6 p-4">
        <div>
           <Link href={`/events/${slug}/stats`} className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-2 w-fit">
              ← Back to Overview
           </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-outline-variant overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant bg-surface-variant">
              <h3 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface">Player Form (Top 20)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background">
                  <tr>
                    <th className="px-4 py-2 text-left font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Player</th>
                    <th className="px-4 py-2 text-right font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">MP (L5)</th>
                    <th className="px-4 py-2 text-right font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {playerForm.length > 0 ? playerForm.slice(0, 20).map((p: any) => (
                    <tr key={p.event_player_id} className="hover:bg-surface-variant transition-colors">
                      <td className="px-4 py-2">
                        <div className="font-semibold text-on-surface">{p.player_name || 'Unknown'}</div>
                        <div className="text-xs text-on-surface-variant">{p.team_name}</div>
                      </td>
                      <td className="px-4 py-2 text-right text-on-surface-variant font-mono tabular-nums">{p.matches_played}</td>
                      <td className="px-4 py-2 text-right text-primary-container font-bold font-mono tabular-nums">
                        {p.avg_rating ? p.avg_rating.toFixed(2) : '-'}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-on-surface-variant">Insufficient tracked data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant bg-surface-variant">
              <h3 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface">Team Form</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background">
                  <tr>
                    <th className="px-4 py-2 text-left font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Team</th>
                    <th className="px-4 py-2 text-left font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Last 5</th>
                    <th className="px-4 py-2 text-right font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {teamForm.length > 0 ? teamForm.map((t: any) => (
                    <tr key={t.team_id} className="hover:bg-surface-variant transition-colors">
                      <td className="px-4 py-2">
                        <Link href={`/events/${slug}/teams/${t.team_id}`} className="font-semibold text-on-surface hover:text-primary-container">
                          {t.team_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex space-x-1">
                          {t.last_5_results && t.last_5_results.map((res: string, i: number) => (
                            <span key={i} className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold ${
                              res === 'W' ? 'bg-primary-container/20 text-primary-container' :
                              res === 'D' ? 'bg-surface-variant text-on-surface-variant' :
                              'bg-error/20 text-error'
                            }`}>
                              {res}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-on-surface font-bold font-mono tabular-nums">
                        {t.last_5_points}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-on-surface-variant">Insufficient tracked data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
