"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { User, MediaAsset } from "@locofoot/shared-types";
import { User as SupabaseAuthUser } from "@supabase/supabase-js";
import Image from "next/image";
import { ShareButton } from "@/components/shared/ShareButton";

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
    <div className="max-w-2xl mx-auto mt-10 p-6 border rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {profileUrl && <ShareButton url={profileUrl} title="Share Profile" />}
      </div>
      
      <div className="flex items-center gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center relative">
          {avatar ? (
            <Image src={avatar.secure_url} alt="Avatar" fill className="object-cover" unoptimized />
          ) : (
            <span className="text-slate-500 dark:text-zinc-400">No Avatar</span>
          )}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{profile?.display_name || user.email}</h2>
          <p className="text-slate-500 dark:text-zinc-400">{user.email}</p>
          {profile?.unique_code && (
            <div className="mt-2 inline-block bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-3 py-1 rounded-md font-mono text-sm border border-slate-200 dark:border-zinc-800">
              <span className="font-semibold text-slate-500 dark:text-zinc-400 mr-2">Friend Code:</span>
              {profile.unique_code}
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Upload Avatar</h3>
        <ImageUploader 
          ownerType="USER_AVATAR" 
          ownerId={user.id} 
          onUploadSuccess={() => {
            // refresh page to see new avatar
            window.location.reload();
          }} 
        />
      </div>

      {refereeMatches.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-amber-900 dark:text-amber-500 mb-4 border-b pb-2">My Referee Assignments</h3>
          <div className="grid gap-4">
            {refereeMatches.map((rm) => (
              <div key={rm.id} className="border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold">{rm.matches.events.name}</h4>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">Match ID: {rm.matches.id.substring(0, 8)}... | Status: {rm.matches.match_state}</p>
                </div>
                <button 
                  onClick={() => router.push(`/admin/events/${rm.matches.events.id}/matches/${rm.matches.id}/referee`)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded shadow"
                >
                  Enter Command Center
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button 
        onClick={() => {
          supabase.auth.signOut();
          router.push("/login");
        }}
        className="text-red-600 hover:underline"
      >
        Sign Out
      </button>
    </div>
  );
}
