import Image from "next/image";
import Link from "next/link";
import { User, MediaAsset } from "@locofoot/shared-types";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  let targetId = id;

  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const currentUser = session?.user || null;

  if (targetId === "me") {
    if (!currentUser) {
      return (
        <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
          <div className="text-center space-y-6 p-8 border border-outline-variant bg-surface max-w-md">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">person_off</span>
            <h1 className="font-headline-sm uppercase tracking-tighter text-on-surface">Not Logged In</h1>
            <p className="font-body-md text-on-surface-variant">You must be logged in to view your own profile.</p>
            <Link href="/login" className="inline-block border border-outline-variant bg-background hover:bg-surface-variant px-6 py-3 font-label-caps text-[10px] text-on-surface uppercase tracking-widest transition-colors">
              Go to Login
            </Link>
          </div>
        </div>
      );
    }
    targetId = currentUser.id;
  }

  // Use service role to bypass RLS for public profile data
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: pData } = await supabaseAdmin
    .from("users")
    .select("*, media_assets(*)")
    .eq("id", targetId)
    .single();

  const { data: privacyData } = await supabaseAdmin
    .from("user_privacy_settings")
    .select("*")
    .eq("user_id", targetId)
    .single();

  if (!pData || !privacyData) {
    return <div className="p-10 text-center text-on-surface-variant">Profile not found.</div>;
  }

  const profile = pData as unknown as User;
  const avatar = pData.media_assets as MediaAsset | null;

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      {/* Header Profile Section */}
      <div className="relative w-full overflow-hidden border-b border-outline-variant bg-[#151816] pt-16 pb-8 px-margin-mobile md:px-gutter shrink-0">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40 z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent z-10" />
          <img alt="" aria-hidden="true" className="w-full h-full object-cover  opacity-40 " src="/turf/turf-closeup.jpg" />
        </div>
        <div className="relative z-20 max-w-container-max mx-auto flex flex-col md:flex-row items-center md:items-end gap-6">
          <div className="w-32 h-32 md:w-48 md:h-48 border border-outline-variant bg-surface flex items-center justify-center relative shrink-0 overflow-hidden">
            {avatar ? (
              <Image src={avatar.secure_url} alt="Avatar" fill className="object-cover" unoptimized />
            ) : (
              <span className="text-on-surface-variant font-display-lg text-display-lg uppercase">
                {profile.display_name ? profile.display_name.charAt(0) : '?'}
              </span>
            )}
          </div>
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4 flex-1">
            <h1 className="font-display-lg text-display-lg md:text-[80px] uppercase tracking-tighter leading-none text-on-surface truncate w-full max-w-full">
              {profile.display_name || 'UNNAMED'}
            </h1>
            
            {profile.unique_code && (
              <div className="inline-flex items-center gap-2 border border-primary-container bg-primary-container/10 px-4 py-2 text-primary-container">
                <span className="font-label-caps text-[10px] uppercase tracking-widest opacity-75">ID</span>
                <span className="font-headline-sm uppercase tracking-tighter">{profile.unique_code}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            {privacyData.profile_public ? (
              <div className="border border-outline-variant bg-surface p-6 md:p-12">
                <h2 className="font-headline-lg-mobile uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-4 mb-8">About</h2>
                
                <div className="space-y-8">
                  {profile.bio && (
                    <div>
                      <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">Bio</span>
                      <p className="font-body-md text-on-surface whitespace-pre-wrap">{profile.bio}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-8 pt-4 border-t border-outline-variant">
                    {profile.location_text && (
                      <div>
                        <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">Location</span>
                        <p className="font-headline-sm uppercase tracking-tighter text-on-surface">{profile.location_text}</p>
                      </div>
                    )}
                    {profile.preferred_position && (
                      <div>
                        <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">Position</span>
                        <p className="font-headline-sm uppercase tracking-tighter text-on-surface">{profile.preferred_position}</p>
                      </div>
                    )}
                    {(profile as any).dominant_foot && (
                      <div>
                        <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">Strong Foot</span>
                        <p className="font-headline-sm uppercase tracking-tighter text-on-surface">{(profile as any).dominant_foot}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-outline-variant bg-surface p-12 text-center">
                <p className="font-headline-sm uppercase tracking-tighter text-on-surface-variant">Profile is private</p>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="border border-outline-variant bg-surface p-6 flex flex-col items-center text-center">
              {currentUser && currentUser.id !== profile.id && profile.unique_code ? (
                <Link 
                  href={`/friends?add=${profile.unique_code}`}
                  className="w-full bg-primary-container text-on-primary-container py-4 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors"
                >
                  ADD FRIEND
                </Link>
              ) : !currentUser && profile.unique_code ? (
                <Link 
                  href="/login"
                  className="w-full border border-outline-variant bg-background text-on-surface py-4 font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors"
                >
                  LOG IN TO ADD FRIEND
                </Link>
              ) : currentUser && currentUser.id === profile.id ? (
                <div className="py-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">THIS IS YOUR PROFILE</div>
              ) : (
                <div className="py-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">CANNOT BE ADDED</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
