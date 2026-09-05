"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { User, MediaAsset } from "@locofoot/shared-types";
import { User as SupabaseAuthUser } from "@supabase/supabase-js";
import Image from "next/image";
import { ShareButton } from "@/components/shared/ShareButton";
import { TurfHero } from "@/components/shared/TurfHero";

export default function DashboardPage() {
  const [user, setUser] = useState<SupabaseAuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [avatar, setAvatar] = useState<MediaAsset | null>(null);
  const [profileUrl, setProfileUrl] = useState("");
  const [refereeMatches, setRefereeMatches] = useState<any[]>([]);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
      setProfileUrl(`${window.location.origin}/u/${session.user.id}`);

      // Load user profile
      const { data: pData } = await supabase
        .from("users")
        .select("*, media_assets(*)")
        .eq("id", session.user.id)
        .single();
      
      if (pData) {
        setProfile(pData as unknown as User);
        if (pData.media_assets) {
          setAvatar(pData.media_assets);
        }
      }

      // Load Referee Matches
      // 1. Matches they were explicitly assigned to
      const { data: explicitMatches } = await supabase
        .from("match_referees")
        .select("*, matches!inner(*, events!inner(id, name))")
        .eq("user_id", session.user.id)
        .in("status", ["ACCEPTED", "ASSIGNED"]);
        
      // 2. All matches in events where they are a Tournament Referee
      const { data: eventRoles } = await supabase
        .from("event_roles")
        .select("event_id")
        .eq("user_id", session.user.id)
        .eq("role", "REFEREE");
        
      let tournamentMatches: any[] = [];
      if (eventRoles && eventRoles.length > 0) {
        const eventIds = eventRoles.map(r => r.event_id);
        const { data: tMatches } = await supabase
          .from("matches")
          .select("*, events!inner(id, name)")
          .in("event_id", eventIds);
          
        if (tMatches) {
          tournamentMatches = tMatches.map(m => ({
            id: `tournament-ref-${m.id}`,
            matches: m
          }));
        }
      }
      
      const allMatches = [...(explicitMatches || []), ...tournamentMatches];
      // Deduplicate by match id
      const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.matches.id, item])).values());
      setRefereeMatches(uniqueMatches);
    }
    loadData();
  }, [router, supabase]);

  if (!user) return <div className="p-10">Loading...</div>;

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      {/* Header */}
      <TurfHero
        eyebrow="Your Command Hub"
        title={profile?.display_name ? <>Welcome, <span className="text-primary-container">{profile.display_name}</span></> : "Dashboard"}
        subtitle="Manage your profile, view your active assignments, and update your settings."
        image="/turf/stadium.jpg"
        size="md"
        actions={profileUrl ? <ShareButton url={profileUrl} title="Share Profile" /> : undefined}
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-12">
        {/* Profile Section */}
        <div className="flex flex-col md:flex-row gap-8 items-start border border-outline-variant bg-surface p-6">
          <div className="w-32 h-32 bg-background border border-outline-variant flex items-center justify-center relative shrink-0 overflow-hidden">
            {avatar ? (
              <Image src={avatar.secure_url} alt="Avatar" fill className="object-cover" unoptimized />
            ) : (
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">person</span>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:text-headline-lg uppercase tracking-tighter">{profile?.display_name || user.email}</h2>
            <p className="font-body-md text-on-surface-variant">{user.email}</p>
            {profile?.unique_code && (
              <div className="mt-4 flex items-center gap-4 bg-background border border-outline-variant px-4 py-2 w-max">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Friend Code</span>
                <span className="font-mono text-primary-container font-bold tracking-widest select-all">{profile.unique_code}</span>
              </div>
            )}
          </div>
          {profileUrl && (
            <div className="md:hidden mt-4 w-full">
              <ShareButton url={profileUrl} title="Share Profile" />
            </div>
          )}
        </div>

        <div className="border border-outline-variant bg-surface p-6">
          <h3 className="font-headline-sm uppercase tracking-tighter mb-4">Upload Avatar</h3>
          <div className="max-w-md">
            <ImageUploader 
              ownerType="USER_AVATAR" 
              ownerId={user.id} 
              onUploadSuccess={() => {
                window.location.reload();
              }} 
            />
          </div>
        </div>

        {refereeMatches.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-headline-lg-mobile uppercase tracking-tighter text-error border-b border-error pb-2">My Referee Assignments</h3>
            <div className="grid grid-cols-1 border border-outline-variant bg-surface divide-y divide-outline-variant">
              {refereeMatches.map((rm) => (
                <div key={rm.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-surface-variant transition-colors">
                  <div>
                    <h4 className="font-headline-sm uppercase tracking-tighter text-on-surface">{rm.matches.events.name}</h4>
                    <p className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                      Match ID: <span className="font-mono">{rm.matches.id.substring(0, 8)}</span> <span className="mx-2">|</span> Status: {rm.matches.match_state}
                    </p>
                  </div>
                  <button 
                    onClick={() => router.push(`/admin/events/${rm.matches.events.id}/matches/${rm.matches.id}/referee`)}
                    className="border border-error bg-error/10 hover:bg-error/20 text-error px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors flex items-center gap-2"
                  >
                    Command Center
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-8 border-t border-outline-variant">
          <button 
            onClick={() => {
              supabase.auth.signOut();
              router.push("/login");
            }}
            className="border border-outline-variant bg-background hover:bg-surface-variant text-error px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
