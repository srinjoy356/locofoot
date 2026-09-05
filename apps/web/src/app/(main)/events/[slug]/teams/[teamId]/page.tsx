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
    <div className="space-y-8 print:p-0 print:m-0">
      <div className="flex items-center justify-between mb-6 border-b dark:border-zinc-800 pb-4 print:border-b-2 print:border-slate-900">
        <div className="flex items-center space-x-4">
          <Link href={`/events/${slug}/stats/teams`} className="text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors print:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold dark:text-zinc-100">{stats.team_name}</h1>
        </div>
        <div className="print:hidden flex gap-2">
          {isCaptain && (
            <Link href={`/events/${slug}/teams/${teamId}/settings`} className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-md font-medium text-sm transition-colors border dark:border-zinc-700">
              <Settings size={16} />
              Edit Team
            </Link>
          )}
          <ShareButton url={`/events/${slug}/teams/${teamId}`} title="Share Team" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm print:border-slate-200">
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Matches</p>
          <p className="text-3xl font-bold font-mono dark:text-zinc-100">{stats.matches_played}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm print:border-slate-200">
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Wins</p>
          <p className="text-3xl font-bold font-mono text-green-600 dark:text-green-500">{stats.wins}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm print:border-slate-200">
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Draws</p>
          <p className="text-3xl font-bold font-mono text-yellow-500">{stats.draws}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm print:border-slate-200">
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Losses</p>
          <p className="text-3xl font-bold font-mono text-red-600 dark:text-red-500">{stats.losses}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm print:border-slate-200">
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Points</p>
          <p className="text-3xl font-bold font-mono text-blue-600 dark:text-blue-400">{stats.points}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm print:border-slate-200">
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Goals For</p>
          <p className="text-3xl font-bold font-mono dark:text-zinc-100">{stats.goals_for}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm print:border-slate-200">
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Goals Against</p>
          <p className="text-3xl font-bold font-mono dark:text-zinc-100">{stats.goals_against}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-sm print:border-slate-200">
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Goal Diff</p>
          <p className={`text-3xl font-bold font-mono ${stats.goal_difference > 0 ? 'text-green-600 dark:text-green-500' : stats.goal_difference < 0 ? 'text-red-600 dark:text-red-500' : 'dark:text-zinc-100'}`}>
            {stats.goal_difference > 0 ? '+' : ''}{stats.goal_difference}
          </p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="p-5 border-b dark:border-zinc-800 print:border-b-2 print:border-slate-900">
          <h2 className="text-xl font-bold flex items-center gap-2 dark:text-zinc-100"><Users size={20}/> Team Roster</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5">
          {roster?.map((player) => {
            const user = player.users as any;
            if (!user?.unique_code) return null;
            return (
              <Link 
                key={player.id} 
                href={`/players/${user.unique_code}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-zinc-700"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border dark:border-zinc-700 relative">
                  {user.media_assets?.secure_url ? (
                    <Image src={user.media_assets.secure_url} alt={user.display_name} fill className="object-cover" unoptimized />
                  ) : (
                    <span className="text-sm font-medium text-slate-500">{user.display_name?.charAt(0) || '?'}</span>
                  )}
                </div>
                <div>
                  <div className="font-semibold dark:text-zinc-100">{user.display_name}</div>
                  <div className="text-xs font-mono text-slate-400">{user.unique_code}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="print:hidden flex justify-center py-8">
        <QRCodeBlock url={`/events/${slug}/teams/${teamId}`} title="Team Profile QR" />
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
