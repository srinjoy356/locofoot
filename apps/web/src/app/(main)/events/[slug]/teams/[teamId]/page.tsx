import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

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
    notFound();
  }

  if (!stats) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <Link href={`/events/${slug}/stats/teams`} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold font-display">{stats.team_name}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Matches</p>
          <p className="text-3xl font-bold font-mono text-white">{stats.matches_played}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Wins</p>
          <p className="text-3xl font-bold font-mono text-green-500">{stats.wins}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Draws</p>
          <p className="text-3xl font-bold font-mono text-yellow-500">{stats.draws}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Losses</p>
          <p className="text-3xl font-bold font-mono text-red-500">{stats.losses}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Points</p>
          <p className="text-3xl font-bold font-mono text-locofoot-400">{stats.points}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Goals For</p>
          <p className="text-3xl font-bold font-mono text-white">{stats.goals_for}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Goals Against</p>
          <p className="text-3xl font-bold font-mono text-white">{stats.goals_against}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Goal Diff</p>
          <p className={`text-3xl font-bold font-mono ${stats.goal_difference > 0 ? 'text-green-500' : stats.goal_difference < 0 ? 'text-red-500' : 'text-white'}`}>
            {stats.goal_difference > 0 ? '+' : ''}{stats.goal_difference}
          </p>
        </div>
      </div>
      
      {/* Additional team breakdown could go here in Phase 5C or later */}
    </div>
  );
}

export default async function TeamStatsPage({ params }: { params: Promise<{ slug: string, teamId: string }> }) {
  const { slug, teamId } = await params;
  return (
    <div className="max-w-4xl mx-auto py-8">
      <Suspense fallback={<div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-zinc-800 rounded w-3/4"></div><div className="space-y-2"><div className="h-4 bg-zinc-800 rounded"></div><div className="h-4 bg-zinc-800 rounded w-5/6"></div></div></div></div>}>
        <TeamStatsContent slug={slug} teamId={teamId} />
      </Suspense>
    </div>
  );
}
