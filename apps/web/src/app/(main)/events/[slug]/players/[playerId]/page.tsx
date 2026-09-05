import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { TurfHero } from '@/components/shared/TurfHero';

async function PlayerStatsContent({ slug, playerId }: { slug: string, playerId: string }) {
  let stats;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const res = await fetch(`${apiUrl}/api/v1/statistics/players/${playerId}`, { cache: 'no-store' });
    if (res.ok) {
        stats = await res.json();
    }
  } catch (err) {
    console.error(err);
    notFound();
  }

  if (!stats) notFound();

  return (
    <>
      <TurfHero
        eyebrow={stats.player_unique_code}
        title={stats.player_name}
        subtitle="Tournament performance & detailed statistics."
        image="/turf/aerial-goal.jpg"
        size="sm"
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 md:py-12 space-y-8">
        <Link href={`/events/${slug}/stats/players`} className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors font-label-caps text-label-caps uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Back to Players
        </Link>

        <div className="border border-outline-variant bg-surface p-6">
          <h2 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-6">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-2">Matches Played</p>
              <p className="text-3xl font-black font-mono text-on-surface tabular-nums">{stats.matches_played}</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-2">Minutes Played</p>
              <p className="text-3xl font-black font-mono text-on-surface tabular-nums">{stats.minutes_played || 0}</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-2">Goals</p>
              <p className="text-3xl font-black font-mono text-primary-container tabular-nums">{stats.goals}</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-2">Assists</p>
              <p className="text-3xl font-black font-mono text-primary-container tabular-nums">{stats.assists}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-outline-variant bg-surface p-6 space-y-4">
            <h2 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Attack</h2>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Goals</span>
              <span className="font-mono text-on-surface">{stats.goals}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Penalty Goals</span>
              <span className="font-mono text-on-surface">{stats.penalty_goals}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Shots</span>
              <span className="font-mono text-on-surface">{stats.shots}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Shots on Target</span>
              <span className="font-mono text-on-surface">{stats.shots_on_target}</span>
            </div>
          </div>

          <div className="border border-outline-variant bg-surface p-6 space-y-4">
            <h2 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Playmaking</h2>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Assists</span>
              <span className="font-mono text-on-surface">{stats.assists}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Key Passes</span>
              <span className="font-mono text-on-surface">{stats.key_passes}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Passes Completed / Attempted</span>
              <span className="font-mono text-on-surface">{stats.passes_completed} / {stats.passes_attempted}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Successful Dribbles</span>
              <span className="font-mono text-on-surface">{stats.successful_dribbles} / {stats.dribbles_attempted}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Great First Touches</span>
              <span className="font-mono text-on-surface">{stats.great_first_touches}</span>
            </div>
          </div>

          <div className="border border-outline-variant bg-surface p-6 space-y-4">
            <h2 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Defense & Goalkeeping</h2>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Tackles Won</span>
              <span className="font-mono text-on-surface">{stats.tackles_won}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Interceptions</span>
              <span className="font-mono text-on-surface">{stats.interceptions}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Recoveries & Clearances</span>
              <span className="font-mono text-on-surface">{stats.recoveries + stats.clearances}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Saves</span>
              <span className="font-mono text-on-surface">{stats.saves}</span>
            </div>
          </div>

          <div className="border border-outline-variant bg-surface p-6 space-y-4">
            <h2 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Discipline</h2>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Yellow Cards</span>
              <span className="font-mono text-yellow-400">{stats.yellow_cards}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Red Cards</span>
              <span className="font-mono text-error">{stats.red_cards}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Fouls Committed</span>
              <span className="font-mono text-on-surface">{stats.fouls_committed}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant pb-2">
              <span className="font-body-md text-on-surface-variant">Fouls Drawn</span>
              <span className="font-mono text-on-surface">{stats.fouls_drawn}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default async function PlayerStatsPage({ params }: { params: Promise<{ slug: string, playerId: string }> }) {
  const { slug, playerId } = await params;
  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      <Suspense fallback={
        <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-24">
          <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest animate-pulse">Loading Player Statistics...</div>
        </div>
      }>
        <PlayerStatsContent slug={slug} playerId={playerId} />
      </Suspense>
    </div>
  );
}
