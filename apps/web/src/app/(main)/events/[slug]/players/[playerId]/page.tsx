import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

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
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <Link href={`/events/${slug}/stats/players`} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold font-display">{stats.player_name}</h1>
          <p className="text-zinc-400 text-sm">{stats.player_unique_code}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-zinc-500">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-zinc-400 font-medium">Matches Played</p>
            <p className="text-2xl font-bold font-mono text-white">{stats.matches_played}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400 font-medium">Minutes Played</p>
            <p className="text-2xl font-bold font-mono text-white">{stats.minutes_played || 0}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400 font-medium">Goals</p>
            <p className="text-2xl font-bold font-mono text-locofoot-400">{stats.goals}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400 font-medium">Assists</p>
            <p className="text-2xl font-bold font-mono text-locofoot-400">{stats.assists}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-bold uppercase tracking-wider text-zinc-500">Attack</h2>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Goals</span>
            <span className="font-mono text-white">{stats.goals}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Penalty Goals</span>
            <span className="font-mono text-white">{stats.penalty_goals}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Shots</span>
            <span className="font-mono text-white">{stats.shots}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Shots on Target</span>
            <span className="font-mono text-white">{stats.shots_on_target}</span>
          </div>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-bold uppercase tracking-wider text-zinc-500">Playmaking</h2>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Assists</span>
            <span className="font-mono text-white">{stats.assists}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Key Passes</span>
            <span className="font-mono text-white">{stats.key_passes}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Passes Completed / Attempted</span>
            <span className="font-mono text-white">{stats.passes_completed} / {stats.passes_attempted}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Successful Dribbles</span>
            <span className="font-mono text-white">{stats.successful_dribbles} / {stats.dribbles_attempted}</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-bold uppercase tracking-wider text-zinc-500">Defense & Goalkeeping</h2>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Tackles Won</span>
            <span className="font-mono text-white">{stats.tackles_won}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Interceptions</span>
            <span className="font-mono text-white">{stats.interceptions}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Recoveries & Clearances</span>
            <span className="font-mono text-white">{stats.recoveries + stats.clearances}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Saves</span>
            <span className="font-mono text-white">{stats.saves}</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-bold uppercase tracking-wider text-zinc-500">Discipline</h2>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Yellow Cards</span>
            <span className="font-mono text-yellow-500">{stats.yellow_cards}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Red Cards</span>
            <span className="font-mono text-red-500">{stats.red_cards}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Fouls Committed</span>
            <span className="font-mono text-white">{stats.fouls_committed}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Fouls Drawn</span>
            <span className="font-mono text-white">{stats.fouls_drawn}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function PlayerStatsPage({ params }: { params: Promise<{ slug: string, playerId: string }> }) {
  const { slug, playerId } = await params;
  return (
    <div className="max-w-4xl mx-auto py-8">
      <Suspense fallback={<div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-zinc-800 rounded w-3/4"></div><div className="space-y-2"><div className="h-4 bg-zinc-800 rounded"></div><div className="h-4 bg-zinc-800 rounded w-5/6"></div></div></div></div>}>
        <PlayerStatsContent slug={slug} playerId={playerId} />
      </Suspense>
    </div>
  );
}
