import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShareButton } from "@/components/shared/ShareButton";
import { QRCodeBlock } from "@/components/shared/QRCodeBlock";
import { Trophy, Activity, Calendar, Star, Users } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ uniqueCode: string }> }) {
  const { uniqueCode } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("display_name").eq("unique_code", uniqueCode).single();
  return {
    title: `${data?.display_name || 'Player'} · LocoFoot`,
    description: `View ${data?.display_name || 'Player'}'s official LocoFoot football profile and statistics.`,
    openGraph: {
      title: `${data?.display_name || 'Player'} · LocoFoot`,
      description: `View ${data?.display_name || 'Player'}'s official LocoFoot football profile and statistics.`,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${data?.display_name || 'Player'} · LocoFoot`,
      description: `View ${data?.display_name || 'Player'}'s official LocoFoot football profile and statistics.`,
    },
  };
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ uniqueCode: string }> }) {
  const { uniqueCode } = await params;
  const supabase = await createClient();

  // Fetch base player data (public fields only)
  const { data: pData } = await supabase
    .from("users")
    .select("id, unique_code, display_name, bio, location_text, preferred_position, dominant_foot, media_assets(secure_url)")
    .eq("unique_code", uniqueCode)
    .single();

  if (!pData) return notFound();

  // Fetch privacy settings
  const { data: privacyData } = await supabase
    .from("user_privacy_settings")
    .select("*")
    .eq("user_id", pData.id)
    .single();

  const profilePublic = privacyData?.profile_public ?? true;
  const statsPublic = privacyData?.stats_public ?? true;

  const avatarUrl = Array.isArray(pData.media_assets) 
    ? (pData.media_assets[0] as any)?.secure_url 
    : (pData.media_assets as any)?.secure_url || null;

  // Fetch player's team registrations
  const { data: etps } = await supabase
    .from("event_team_players")
    .select("id, event_registration_id, team:event_team_registrations(event_id, team_name)")
    .eq("user_id", pData.id);

  const eventPlayerIds = etps?.map(e => e.id) || [];
  let eventStats: any[] = [];

  if (eventPlayerIds.length > 0) {
    // Fetch all match stats directly (avoids exploding JOINs in tournament_player_stats_view)
    const { data: matchStats } = await supabase
      .from("player_match_stats_view")
      .select("event_player_id, goals, assists, yellow_cards, red_cards")
      .in("event_player_id", eventPlayerIds);

    const statsByTeam: Record<string, any> = {};
    etps?.forEach(etp => {
      statsByTeam[etp.id] = {
        team_name: (etp.team as any)?.team_name || "Unknown Team",
        matches_played: 0,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0
      };
    });

    matchStats?.forEach(stat => {
      const teamStat = statsByTeam[stat.event_player_id];
      if (teamStat) {
        teamStat.matches_played += 1;
        teamStat.goals += stat.goals || 0;
        teamStat.assists += stat.assists || 0;
        teamStat.yellow_cards += stat.yellow_cards || 0;
        teamStat.red_cards += stat.red_cards || 0;
      }
    });

    // Only show teams where they actually played or were registered
    eventStats = Object.values(statsByTeam);
  }
  
  // Aggregate career stats
  const career = eventStats.reduce((acc, curr) => ({
    matches: acc.matches + (curr.matches_played || 0),
    goals: acc.goals + (curr.goals || 0),
    assists: acc.assists + (curr.assists || 0),
    yellowCards: acc.yellowCards + (curr.yellow_cards || 0),
    redCards: acc.redCards + (curr.red_cards || 0),
  }), { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 });

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8 print:p-0 print:m-0">
      
      {/* Header Profile Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border dark:border-zinc-800 overflow-hidden print:border-none print:shadow-none">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-800 relative print:h-24 print:bg-white print:border-b"></div>
        <div className="px-6 pb-6 pt-20 relative sm:pt-20">
          <div className="absolute -top-16 left-6 w-32 h-32 rounded-full border-4 border-white dark:border-zinc-900 bg-slate-100 overflow-hidden print:-top-12">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={pData.display_name || "Avatar"} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-light text-slate-400">
                {pData.display_name?.charAt(0) || '?'}
              </div>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:mt-0">
            <div>
              <h1 className="text-3xl font-bold dark:text-zinc-100">{pData.display_name || "Unnamed Player"}</h1>
              <p className="text-slate-500 font-mono mt-1 text-sm">{pData.unique_code}</p>
            </div>
            
            <div className="flex items-center gap-3 print:hidden">
              <ShareButton url={`/players/${pData.unique_code}`} title="Share Player" />
            </div>
          </div>
        </div>
      </div>

      {/* Career Overview */}
      {statsPublic ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-5 rounded-xl shadow-sm text-center print:border-slate-200">
            <div className="text-slate-500 dark:text-zinc-400 text-sm font-medium mb-1 flex items-center justify-center gap-1"><Activity size={16}/> Matches</div>
            <div className="text-3xl font-bold dark:text-zinc-100">{career.matches}</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-5 rounded-xl shadow-sm text-center print:border-slate-200">
            <div className="text-slate-500 dark:text-zinc-400 text-sm font-medium mb-1 flex items-center justify-center gap-1"><Trophy size={16}/> Goals</div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{career.goals}</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-5 rounded-xl shadow-sm text-center print:border-slate-200">
            <div className="text-slate-500 dark:text-zinc-400 text-sm font-medium mb-1 flex items-center justify-center gap-1"><Star size={16}/> Assists</div>
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{career.assists}</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-5 rounded-xl shadow-sm text-center print:border-slate-200">
            <div className="text-slate-500 dark:text-zinc-400 text-sm font-medium mb-1 flex items-center justify-center gap-1">Discipline</div>
            <div className="flex justify-center gap-2 text-xl font-bold">
              <span className="text-yellow-500">{career.yellowCards}</span>
              <span className="text-slate-300">/</span>
              <span className="text-red-500">{career.redCards}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-zinc-900/50 p-6 rounded-xl border dark:border-zinc-800 text-center italic text-slate-500">
          This player's statistics are private.
        </div>
      )}

      {profilePublic && (
        <div className="mt-8 bg-white dark:bg-zinc-900 p-6 rounded-xl border dark:border-zinc-800 shadow-sm print:border-slate-200">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">About</h2>
          
          <div className="space-y-4 text-sm">
            {pData.bio && (
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block mb-1 font-medium">Bio</span>
                <p className="whitespace-pre-wrap">{pData.bio}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {pData.location_text && (
                <div>
                  <span className="text-slate-500 dark:text-zinc-400 block mb-1 font-medium">Location</span>
                  <p className="font-semibold text-base">{pData.location_text}</p>
                </div>
              )}
              {pData.preferred_position && (
                <div>
                  <span className="text-slate-500 dark:text-zinc-400 block mb-1 font-medium">Position</span>
                  <p className="font-semibold text-base">{pData.preferred_position}</p>
                </div>
              )}
              {pData.dominant_foot && (
                <div>
                  <span className="text-slate-500 dark:text-zinc-400 block mb-1 font-medium">Strong Foot</span>
                  <p className="font-semibold text-base">{pData.dominant_foot}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tournament History */}
      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden print:shadow-none print:border-none">
        <div className="p-5 border-b dark:border-zinc-800 print:border-b-2 print:border-slate-900">
          <h2 className="text-xl font-bold flex items-center gap-2 dark:text-zinc-100"><Calendar size={20}/> Tournament History</h2>
        </div>
        
        {eventStats.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No tournament appearances yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Team</th>
                  <th className="px-5 py-3 font-medium">Matches</th>
                  <th className="px-5 py-3 font-medium">Goals</th>
                  <th className="px-5 py-3 font-medium">Assists</th>
                  <th className="px-5 py-3 font-medium">Cards (Y/R)</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-zinc-800">
                {eventStats.map((stat, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold dark:text-zinc-100">{stat.team_name}</div>
                    </td>
                    <td className="px-5 py-4 dark:text-zinc-300">{stat.matches_played || 0}</td>
                    <td className="px-5 py-4 font-medium text-blue-600 dark:text-blue-400">{stat.goals || 0}</td>
                    <td className="px-5 py-4 dark:text-zinc-300">{stat.assists || 0}</td>
                    <td className="px-5 py-4 dark:text-zinc-300">
                      <span className="text-yellow-600">{stat.yellow_cards || 0}</span> / <span className="text-red-500">{stat.red_cards || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="print:hidden flex justify-center py-8">
        <QRCodeBlock url={`/players/${pData.unique_code}`} title="Player Profile QR" />
      </div>

    </div>
  );
}
