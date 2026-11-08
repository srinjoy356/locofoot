import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
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
    .select('id, guest_name, jersey_number, users(unique_code, display_name, media_assets(secure_url))')
    .order('jersey_number', { nullsFirst: false })
    .eq('event_registration_id', teamId);

  return (
    <div className="w-full bg-background min-h-screen text-on-surface">
      {/* Header Profile Section */}
      <div className="w-full border-b border-outline-variant bg-[#151816] relative overflow-hidden shrink-0 min-h-[280px] flex flex-col justify-end pt-16 pb-10 px-margin-mobile md:px-gutter">
        <div className="absolute inset-0 z-0">
          <img alt="" aria-hidden="true" className="w-full h-full object-cover  opacity-45 " src="/turf/stadium.jpg" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent z-10"></div>
        </div>
        <div className="relative z-20 max-w-container-max mx-auto w-full flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 flex-1">
            <div className="w-32 h-32 border border-outline-variant bg-surface flex items-center justify-center relative shrink-0">
              <span className="text-on-surface-variant font-display-lg text-display-lg uppercase">
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
            {/* The captain settings page still targets the removed teams/team_members tables, so no edit link until it is rebuilt */}
            <ShareButton url={`/events/${slug}/teams/${teamId}`} title="Share Team" />
          </div>
        </div>
      </div>

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Matches</span>
            <span className="font-display-lg text-display-sm text-on-surface">{stats.matches_played}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Wins</span>
            <span className="font-display-lg text-display-sm text-primary-container">{stats.wins}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Draws</span>
            <span className="font-display-lg text-display-sm text-yellow-500">{stats.draws}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Losses</span>
            <span className="font-display-lg text-display-sm text-error">{stats.losses}</span>
          </div>
          
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Points</span>
            <span className="font-display-lg text-display-sm text-on-surface">{stats.points}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Goals For</span>
            <span className="font-display-lg text-display-sm text-on-surface">{stats.goals_for}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Goals Against</span>
            <span className="font-display-lg text-display-sm text-on-surface">{stats.goals_against}</span>
          </div>
          <div className="border border-outline-variant bg-surface p-6 flex flex-col gap-2">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Goal Diff</span>
            <span className={`font-display-lg text-display-sm ${stats.goal_difference > 0 ? 'text-primary-container' : stats.goal_difference < 0 ? 'text-error' : 'text-on-surface'}`}>
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
              const name = user?.display_name || player.guest_name || 'Player';
              const body = (
                <>
                  <div className="w-12 h-12 border border-outline-variant bg-background flex items-center justify-center relative shrink-0">
                    {user?.media_assets?.secure_url ? (
                      <Image src={user.media_assets.secure_url} alt={name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all" unoptimized />
                    ) : (
                      <span className="font-headline-sm uppercase text-on-surface-variant">{player.jersey_number ?? name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-headline-sm uppercase tracking-tighter text-on-surface truncate">{name}</div>
                    <div className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">{user?.unique_code || (player.jersey_number ? `#${player.jersey_number}` : 'Guest')}</div>
                  </div>
                </>
              );
              return user?.unique_code ? (
                <Link key={player.id} href={`/players/${user.unique_code}`} className="flex items-center gap-4 p-4 hover:bg-surface-variant transition-colors group">{body}</Link>
              ) : (
                <div key={player.id} className="flex items-center gap-4 p-4 group">{body}</div>
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
    <div className="w-full">
      <Suspense fallback={
        <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-12 animate-pulse space-y-6">
          <div className="h-8 bg-surface-variant w-1/4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-24 bg-surface-variant"></div>
            <div className="h-24 bg-surface-variant"></div>
            <div className="h-24 bg-surface-variant"></div>
            <div className="h-24 bg-surface-variant"></div>
          </div>
        </div>
      }>
        <TeamStatsContent slug={slug} teamId={teamId} />
      </Suspense>
    </div>
  );
}
