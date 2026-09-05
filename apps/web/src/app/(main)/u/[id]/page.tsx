import Image from "next/image";
import Link from "next/link";
import { User, MediaAsset } from "@locofoot/shared-types";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Use service role to bypass RLS for public profile data
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: pData } = await supabaseAdmin
    .from("users")
    .select("*, media_assets(*)")
    .eq("id", id)
    .single();

  const { data: privacyData } = await supabaseAdmin
    .from("user_privacy_settings")
    .select("*")
    .eq("user_id", id)
    .single();

  if (!pData || !privacyData) {
    return <div className="p-10 text-center text-slate-500 dark:text-zinc-400">Profile not found.</div>;
  }

  const profile = pData as unknown as User;
  const avatar = pData.media_assets as MediaAsset | null;

  // Get current user session
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const currentUser = session?.user || null;

  return (
    <div className="max-w-xl mx-auto mt-10 p-8 border rounded-lg bg-white dark:bg-zinc-900 shadow-sm text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center relative border-4 border-gray-50 shadow-sm">
          {avatar ? (
            <Image src={avatar.secure_url} alt="Avatar" fill className="object-cover" unoptimized />
          ) : (
            <span className="text-gray-400 text-3xl font-light">
              {profile.display_name ? profile.display_name.charAt(0).toUpperCase() : '?'}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{profile.display_name || 'Unnamed Player'}</h1>
          
          {profile.unique_code && (
            <div className="mt-4 inline-block bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400 px-4 py-2 rounded-md font-mono text-sm border border-blue-100">
              <span className="font-semibold mr-2 opacity-75">Friend Code:</span>
              <span className="font-bold">{profile.unique_code}</span>
            </div>
          )}
        </div>
      </div>

      {privacyData.profile_public && (
        <div className="mt-8 text-left bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-lg border dark:border-zinc-800">
          <h2 className="font-bold mb-4 border-b pb-2">About</h2>
          
          <div className="space-y-4 text-sm">
            {profile.bio && (
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block mb-1">Bio</span>
                <p className="whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              {profile.location_text && (
                <div>
                  <span className="text-slate-500 dark:text-zinc-400 block mb-1">Location</span>
                  <p className="font-medium">{profile.location_text}</p>
                </div>
              )}
              {profile.preferred_position && (
                <div>
                  <span className="text-slate-500 dark:text-zinc-400 block mb-1">Position</span>
                  <p className="font-medium">{profile.preferred_position}</p>
                </div>
              )}
              {profile.dominant_foot && (
                <div>
                  <span className="text-slate-500 dark:text-zinc-400 block mb-1">Strong Foot</span>
                  <p className="font-medium">{profile.dominant_foot}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 pt-8 border-t border-gray-100 flex justify-center">
        {currentUser && currentUser.id !== profile.id && profile.unique_code ? (
          <Link 
            href={`/friends?add=${profile.unique_code}`}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-md font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            Add as Friend
          </Link>
        ) : !currentUser && profile.unique_code ? (
          <Link 
            href="/login"
            className="bg-black text-white px-6 py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors shadow-sm"
          >
            Log in to Add Friend
          </Link>
        ) : currentUser && currentUser.id === profile.id ? (
          <div className="text-slate-500 dark:text-zinc-400 text-sm italic">This is your public profile</div>
        ) : (
          <div className="text-slate-500 dark:text-zinc-400 text-sm italic">This user cannot be added as a friend</div>
        )}
      </div>
    </div>
  );
}
