import { createClient } from "@/lib/supabase/server";
import ExploreClient from "./ExploreClient";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Explore · LocoFoot",
  description: "Discover football tournaments, teams, and players on LocoFoot.",
  openGraph: {
    title: "Explore · LocoFoot",
    description: "Discover football tournaments, teams, and players on LocoFoot.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore · LocoFoot",
    description: "Discover football tournaments, teams, and players on LocoFoot.",
  },
};

export default async function ExplorePage() {
  const supabase = await createClient();

  // Fetch all public events
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, name, slug, status, start_date, end_date, created_at, event_team_registrations(count)")
    .order("created_at", { ascending: false });

  // Fetch all public players (must have a public profile setting to be visible)
  const { data: playersData } = await supabase
    .from("users")
    .select("id, unique_code, display_name, avatar_media_id, media_assets(secure_url), user_privacy_settings!inner(profile_public)")
    .eq("user_privacy_settings.profile_public", true)
    .not("email", "like", "%@bench.com")
    .order("created_at", { ascending: false })
    .limit(100);

  // Normalize data for the client
  const events = (eventsData || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    status: e.status,
    date: e.start_date || e.created_at,
    teamsCount: e.event_team_registrations?.[0]?.count || 0,
  }));

  const players = (playersData || []).map((p: any) => ({
    id: p.id,
    uniqueCode: p.unique_code,
    name: p.display_name,
    avatar: p.media_assets?.secure_url || null,
  }));

  return (
    <div className="w-full h-full flex flex-col md:flex-row">
      <ExploreClient initialEvents={events} initialPlayers={players} />
    </div>
  );
}
