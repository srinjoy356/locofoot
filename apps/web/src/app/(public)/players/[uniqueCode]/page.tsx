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
    <div className="w-full h-full flex flex-col bg-background text-on-surface print:bg-white print:text-black">
      
      {/* Header Profile Section */}
      <div className="w-full bg-[#0b0d0c] border-b border-outline-variant relative shrink-0 overflow-hidden min-h-[300px] flex flex-col justify-end pt-24 pb-12 px-margin-mobile md:px-gutter">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10"></div>
          {avatarUrl && (
            <Image src={avatarUrl} alt="Avatar" fill className="object-cover filter grayscale opacity-40 mix-blend-luminosity" unoptimized />
          )}
        </div>
        
        <div className="relative z-20 max-w-container-max mx-auto w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-surface-variant border border-outline-variant flex items-center justify-center overflow-hidden shrink-0">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={pData.display_name || "Avatar"} width={128} height={128} className="object-cover w-full h-full grayscale" unoptimized />
              ) : (
                <span className="font-display-lg text-display-lg text-on-surface-variant uppercase">{pData.display_name?.charAt(0) || '?'}</span>
              )}
            </div>
            
            <div className="flex flex-col">
              <span className="font-mono text-on-surface-variant tracking-widest uppercase mb-2">{pData.unique_code}</span>
              <h1 className="font-display-lg text-display-lg md:text-[64px] uppercase tracking-tighter leading-none text-on-surface">
                {pData.display_name || "Unknown"}
              </h1>
            </div>
          </div>
          
          <div className="print:hidden">
            <ShareButton url={`/players/${pData.unique_code}`} title="Share Player" />
          </div>
        </div>
      </div>

      {/* Career Overview */}
      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 md:py-12 flex-1">
        {statsPublic ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-outline-variant bg-[#151816]">
            <div className="p-6 border-b border-r border-outline-variant flex flex-col items-center justify-center hover:bg-surface-variant transition-colors">
              <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-sm">sports_soccer</span> Matches</div>
              <div className="font-mono text-5xl font-black text-on-surface tabular-nums">{career.matches}</div>
            </div>
            <div className="p-6 border-b md:border-r border-outline-variant flex flex-col items-center justify-center hover:bg-surface-variant transition-colors">
              <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-sm">emoji_events</span> Goals</div>
              <div className="font-mono text-5xl font-black text-primary-container tabular-nums">{career.goals}</div>
            </div>
            <div className="p-6 border-b border-r md:border-b-0 border-outline-variant flex flex-col items-center justify-center hover:bg-surface-variant transition-colors">
              <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-sm">star</span> Assists</div>
              <div className="font-mono text-5xl font-black text-on-surface tabular-nums">{career.assists}</div>
            </div>
            <div className="p-6 border-outline-variant flex flex-col items-center justify-center hover:bg-surface-variant transition-colors">
              <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-2">Discipline (Y/R)</div>
              <div className="font-mono text-5xl font-black tabular-nums flex items-center gap-2">
                <span className="text-yellow-400">{career.yellowCards}</span>
                <span className="text-on-surface-variant text-3xl font-light">/</span>
                <span className="text-error">{career.redCards}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-outline-variant bg-surface p-8 text-center text-on-surface-variant font-label-caps text-label-caps uppercase tracking-widest opacity-60">
            This player's statistics are private.
          </div>
        )}

        {profilePublic && (
          <div className="mt-8 border border-outline-variant bg-surface p-6">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase text-on-surface tracking-tighter mb-6 border-b border-outline-variant pb-4">Profile</h2>
            
            <div className="space-y-6">
              {pData.bio && (
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest block mb-2">Bio</span>
                  <p className="font-body-md text-on-surface whitespace-pre-wrap">{pData.bio}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                {pData.location_text && (
                  <div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest block mb-2">Location</span>
                    <p className="font-body-lg text-on-surface uppercase">{pData.location_text}</p>
                  </div>
                )}
                {pData.preferred_position && (
                  <div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest block mb-2">Position</span>
                    <p className="font-body-lg text-on-surface uppercase">{pData.preferred_position}</p>
                  </div>
                )}
                {pData.dominant_foot && (
                  <div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest block mb-2">Strong Foot</span>
                    <p className="font-body-lg text-on-surface uppercase">{pData.dominant_foot}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tournament History */}
        <div className="mt-8">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase text-on-surface tracking-tighter mb-6 flex items-center gap-2">
            Tournament History
          </h2>
          
          {eventStats.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant font-label-caps text-label-caps uppercase border border-outline-variant bg-surface opacity-60 tracking-widest">
              No tournament appearances yet
            </div>
          ) : (
            <div className="border border-outline-variant bg-surface overflow-x-auto w-full">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-surface-variant border-b border-outline-variant text-on-surface-variant font-label-caps text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4 font-normal">Team</th>
                    <th className="px-6 py-4 font-normal">Matches</th>
                    <th className="px-6 py-4 font-normal">Goals</th>
                    <th className="px-6 py-4 font-normal">Assists</th>
                    <th className="px-6 py-4 font-normal">Cards (Y/R)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {eventStats.map((stat, i) => (
                    <tr key={i} className="hover:bg-surface-variant transition-colors">
                      <td className="px-6 py-5">
                        <div className="font-headline-lg-mobile text-on-surface uppercase tracking-tighter">{stat.team_name}</div>
                      </td>
                      <td className="px-6 py-5 font-mono text-on-surface">{stat.matches_played || 0}</td>
                      <td className="px-6 py-5 font-mono text-primary-container font-bold">{stat.goals || 0}</td>
                      <td className="px-6 py-5 font-mono text-on-surface">{stat.assists || 0}</td>
                      <td className="px-6 py-5 font-mono text-on-surface">
                        <span className="text-yellow-400">{stat.yellow_cards || 0}</span> <span className="text-outline-variant font-sans mx-1">/</span> <span className="text-error">{stat.red_cards || 0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="print:hidden flex justify-center py-12">
          <QRCodeBlock url={`/players/${pData.unique_code}`} title="Player Profile QR" />
        </div>

      </div>
    </div>
  );
}
