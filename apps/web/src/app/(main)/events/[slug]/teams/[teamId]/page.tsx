import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Settings } from 'lucide-react';
import { notFound } from 'next/navigation';
import { ShareButton } from '@/components/shared/ShareButton';
import { QRCodeBlock } from '@/components/shared/QRCodeBlock';
import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';

async function TeamStatsContent({ slug, teamId }: { slug: string, teamId: string }) {
  let stats;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const res = await fetch(`${apiUrl}/api/v1/statistics/teams/${teamId}`, { cache: 'no-store' });
    if (res.ok) {
        stats = await res.json();
    }
  } catch (err) {
    console.error(err);
  }

  if (!stats) notFound();

  // Fetch roster
  const supabase = await createClient();
  const { data: roster } = await supabase
    .from('event_team_players')
    .select('id, users(unique_code, display_name, media_assets(secure_url))')
    .eq('event_registration_id', teamId);

  // Check if current user is captain
  let isCaptain = false;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: regData } = await supabase.from('event_team_registrations').select('team_id').eq('id', teamId).single();
    if (regData) {
      const { data: memberData } = await supabase.from('team_members').select('role').eq('team_id', regData.team_id).eq('user_id', session.user.id).single();
      if (memberData?.role === 'CAPTAIN') {
        isCaptain = true;
      }
    }
  }

  return (
    <div className="w-full bg-background min-h-screen text-on-surface">
      {/* Header Profile Section */}
      <div className="w-full border-b border-outline-variant bg-[#0b0d0c] pt-12 pb-8 px-margin-mobile md:px-gutter shrink-0">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 flex-1">
            <div className="w-32 h-32 border border-outline-variant bg-surface flex items-center justify-center relative shrink-0">
              <span className="text-on-surface-variant font-display-md text-display-md uppercase">
                {stats.team_name.charAt(0)}
              </span>
            </div>
            <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4">
              <Link href={`/events/${slug}/stats/teams`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors mb-2 print:hidden">
                <ArrowLeft size={16} />
                <span className="font-label-caps text-[10px] uppercase tracking-widest">Back to Teams</span>
              </Link>
              <h1 className="font-display-lg text-display-lg md:text-[64px] uppercase tracking-tighter leading-none text-on-surface truncate w-full max-w-[80vw]">
                {stats.team_name}
              </h1>
            </div>
          </div>
          
          <div className="print:hidden flex flex-col md:flex-row items-center gap-4 shrink-0">
            {isCaptain && (
              <Link href={`/events/${slug}/teams/${teamId}/settings`} className="border border-primary-container bg-primary-container/10 text-primary-container hover:bg-primary-container/20 px-4 py-2 flex items-center gap-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                <Settings size={16} />
                <span>Edit Team</span>
              </Link>
            )}
            <ShareButton url={`/events/${slug}/teams/${teamId}`} title="Share Team" />
          </div>
        </div>
      </div>

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Matches</span>
            <span className="font-display-md text-display-md text-on-surface">{stats.matches_played}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Wins</span>
            <span className="font-display-md text-display-md text-primary-container">{stats.wins}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Draws</span>
            <span className="font-display-md text-display-md text-yellow-500">{stats.draws}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Losses</span>
            <span className="font-display-md text-display-md text-error">{stats.losses}</span>
          </div>
          
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Points</span>
            <span className="font-display-md text-display-md text-on-surface">{stats.points}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Goals For</span>
            <span className="font-display-md text-display-md text-on-surface">{stats.goals_for}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Goals Against</span>
            <span className="font-display-md text-display-md text-on-surface">{stats.goals_against}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Goal Diff</span>
            <span className={`font-display-md text-display-md ${stats.goal_difference > 0 ? 'text-primary-container' : stats.goal_difference < 0 ? 'text-error' : 'text-on-surface'}`}>
              {stats.goal_difference > 0 ? '+' : ''}{stats.goal_difference}
            </span>
          </div>
        </div>
        
        {/* Roster */}
        <div className="border border-outline-variant bg-surface">
          <div className="p-4 border-b border-outline-variant bg-surface-container">
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface flex items-center gap-2">
              <Users size={16} /> Team Roster
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
            {roster?.map((player) => {
              const user = player.users as any;
              if (!user?.unique_code) return null;
              return (
                <Link 
                  key={player.id} 
                  href={`/players/${user.unique_code}`}
                  className="flex items-center gap-4 p-4 hover:bg-surface-variant transition-colors group"
                >
                  <div className="w-12 h-12 border border-outline-variant bg-background flex items-center justify-center relative shrink-0">
                    {user.media_assets?.secure_url ? (
                      <Image src={user.media_assets.secure_url} alt={user.display_name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all" unoptimized />
                    ) : (
                      <span className="font-headline-sm uppercase text-on-surface-variant">{user.display_name?.charAt(0) || '?'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-headline-sm uppercase tracking-tighter text-on-surface truncate">{user.display_name}</div>
                    <div className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">{user.unique_code}</div>
                  </div>
                </Link>
              );
            })}
            
            {(!roster || roster.length === 0) && (
              <div className="col-span-full p-8 text-center">
                <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">No players found in this roster.</span>
              </div>
            )}
          </div>
        </div>

        <div className="print:hidden flex justify-center py-12">
          <QRCodeBlock url={`/events/${slug}/teams/${teamId}`} title="TEAM PROFILE QR" />
        </div>
      </div>
    </div>
  );
}

export default async function TeamStatsPage({ params }: { params: Promise<{ slug: string, teamId: string }> }) {
  const { slug, teamId } = await params;
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <Suspense fallback={<div className="animate-pulse space-y-6"><div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded w-1/4"></div><div className="grid grid-cols-4 gap-4"><div className="h-24 bg-slate-200 dark:bg-zinc-800 rounded-xl"></div><div className="h-24 bg-slate-200 dark:bg-zinc-800 rounded-xl"></div><div className="h-24 bg-slate-200 dark:bg-zinc-800 rounded-xl"></div><div className="h-24 bg-slate-200 dark:bg-zinc-800 rounded-xl"></div></div></div>}>
        <TeamStatsContent slug={slug} teamId={teamId} />
      </Suspense>
    </div>
  );
}
