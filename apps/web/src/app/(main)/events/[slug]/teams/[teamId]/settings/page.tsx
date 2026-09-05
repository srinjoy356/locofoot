"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Save, Users, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TeamSettingsPage({ params }: { params: Promise<{ slug: string, teamId: string }> }) {
  const [slug, setSlug] = useState("");
  const [regId, setRegId] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [team, setTeam] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    params.then(p => {
      setSlug(p.slug);
      setRegId(p.teamId);
    });
  }, [params]);

  useEffect(() => {
    if (!regId) return;

    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      setUserId(session.user.id);

      // 1. Fetch Event Registration and Team
      const { data: regData } = await supabase
        .from("event_team_registrations")
        .select(`
          id,
          team_id,
          teams (
            id, name, description, instagram_url, website_url, primary_color, secondary_color
          )
        `)
        .eq("id", regId)
        .single();
        
      if (!regData || !regData.teams) {
        setLoading(false);
        return;
      }

      const teamData = Array.isArray(regData.teams) ? regData.teams[0] : regData.teams;
      setTeam(teamData);

      // 2. Check if Captain (in team_members)
      const { data: memberData } = await supabase
        .from("team_members")
        .select("role, status")
        .eq("team_id", (teamData as any).id)
        .eq("user_id", session.user.id)
        .single();
        
      if (!memberData || memberData.role !== 'CAPTAIN') {
        alert("Only the team captain can edit team settings.");
        router.push(`/events/${slug}/teams/${regId}`);
        return;
      }

      // 3. Fetch Roster from event_team_players
      const { data: rosterData } = await supabase
        .from("event_team_players")
        .select(`
          id,
          jersey_number,
          position,
          users (
            id, display_name, unique_code
          )
        `)
        .eq("event_registration_id", regId);

      if (rosterData) {
        setRoster(rosterData);
      }

      setLoading(false);
    }
    
    loadData();
  }, [regId, supabase, router, slug]);

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const { error } = await supabase.from("teams").update({
        description: team.description || null,
        instagram_url: team.instagram_url || null,
        website_url: team.website_url || null,
        primary_color: team.primary_color || null,
        secondary_color: team.secondary_color || null
      }).eq("id", team.id);
      
      if (error) throw error;
      alert("Team details saved successfully!");
    } catch (err: any) {
      alert("Error saving team: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateRosterPlayer = (index: number, field: string, value: string) => {
    const newRoster = [...roster];
    newRoster[index] = { ...newRoster[index], [field]: value === "" ? null : value };
    setRoster(newRoster);
  };

  const handleSaveRoster = async () => {
    setSaving(true);
    try {
      // Upsert/Update all players
      for (const p of roster) {
        await supabase.from("event_team_players").update({
          jersey_number: p.jersey_number ? parseInt(p.jersey_number) : null,
          position: p.position || null
        }).eq("id", p.id);
      }
      alert("Roster updated successfully!");
    } catch (err: any) {
      alert("Error saving roster: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
        <RefreshCw size={16} className="animate-spin" />
        LOADING SETTINGS...
      </div>
    </div>
  );
  
  if (!team) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-error uppercase tracking-widest">TEAM NOT FOUND.</div>
    </div>
  );

  return (
    <div className="w-full bg-background min-h-screen text-on-surface">
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center">
          <Link href={`/events/${slug}/teams/${regId}`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft size={16} />
            <span className="font-label-caps text-label-caps uppercase tracking-widest">BACK TO TEAM</span>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-margin-mobile md:px-gutter py-8 space-y-12">
        <div>
          <h1 className="font-display-lg text-display-lg md:text-[56px] uppercase tracking-tighter leading-none text-on-surface mb-2">
            EDIT TEAM
          </h1>
          <p className="font-headline-sm uppercase tracking-tighter text-on-surface-variant">{team.name}</p>
        </div>

        {/* Team Details Form */}
        <form onSubmit={handleSaveTeam} className="border border-outline-variant bg-surface p-6 md:p-8 space-y-8">
          <div className="border-b border-outline-variant pb-4 mb-6">
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">TEAM DETAILS</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Description</label>
              <textarea 
                value={team.description || ''} 
                onChange={e => setTeam({...team, description: e.target.value})}
                rows={3}
                placeholder="ABOUT YOUR TEAM..."
                className="w-full bg-background border border-outline-variant text-on-surface font-body-md p-4 rounded-none focus:outline-none focus:border-primary-container transition-colors resize-none placeholder:text-on-surface-variant/50"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Instagram URL</label>
                <input 
                  type="url" 
                  value={team.instagram_url || ''} 
                  onChange={e => setTeam({...team, instagram_url: e.target.value})}
                  placeholder="HTTPS://INSTAGRAM.COM/..."
                  className="w-full bg-background border border-outline-variant text-on-surface font-body-md p-4 rounded-none focus:outline-none focus:border-primary-container transition-colors placeholder:text-on-surface-variant/50"
                />
              </div>
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Website URL</label>
                <input 
                  type="url" 
                  value={team.website_url || ''} 
                  onChange={e => setTeam({...team, website_url: e.target.value})}
                  placeholder="HTTPS://..."
                  className="w-full bg-background border border-outline-variant text-on-surface font-body-md p-4 rounded-none focus:outline-none focus:border-primary-container transition-colors placeholder:text-on-surface-variant/50"
                />
              </div>
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Primary Color (Hex)</label>
                <input 
                  type="text" 
                  value={team.primary_color || ''} 
                  onChange={e => setTeam({...team, primary_color: e.target.value})}
                  placeholder="#000000"
                  className="w-full bg-background border border-outline-variant text-on-surface font-mono p-4 rounded-none focus:outline-none focus:border-primary-container transition-colors uppercase placeholder:text-on-surface-variant/50"
                />
              </div>
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Secondary Color (Hex)</label>
                <input 
                  type="text" 
                  value={team.secondary_color || ''} 
                  onChange={e => setTeam({...team, secondary_color: e.target.value})}
                  placeholder="#FFFFFF"
                  className="w-full bg-background border border-outline-variant text-on-surface font-mono p-4 rounded-none focus:outline-none focus:border-primary-container transition-colors uppercase placeholder:text-on-surface-variant/50"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-outline-variant">
            <button type="submit" disabled={saving} className="w-full md:w-auto bg-primary-container text-on-primary-container hover:bg-primary-container/90 px-8 py-4 font-headline-sm uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "SAVING..." : "SAVE TEAM DETAILS"}
            </button>
          </div>
        </form>

        {/* Roster Form */}
        <div className="border border-outline-variant bg-surface">
          <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface-container">
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface flex items-center gap-2">
              <Users size={16} /> EVENT ROSTER
            </h2>
            <button onClick={handleSaveRoster} disabled={saving} className="bg-primary-container text-on-primary-container hover:bg-primary-container/90 px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              SAVE ROSTER
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface">
                  <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Player</th>
                  <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Jersey #</th>
                  <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {roster.map((player, idx) => (
                  <tr key={player.id} className="bg-surface hover:bg-surface-variant/50 transition-colors">
                    <td className="p-4">
                      <div className="font-headline-sm uppercase tracking-tighter text-on-surface">{player.users?.display_name}</div>
                      <div className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">{player.users?.unique_code}</div>
                    </td>
                    <td className="p-4 w-32">
                      <input 
                        type="number" 
                        value={player.jersey_number || ''}
                        onChange={e => updateRosterPlayer(idx, 'jersey_number', e.target.value)}
                        className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 text-center focus:outline-none focus:border-primary-container transition-colors rounded-none placeholder:text-on-surface-variant/50"
                        placeholder="-"
                      />
                    </td>
                    <td className="p-4 w-40">
                      <select 
                        value={player.position || ''}
                        onChange={e => updateRosterPlayer(idx, 'position', e.target.value)}
                        className="w-full bg-background border border-outline-variant text-on-surface font-label-caps text-[10px] uppercase tracking-widest p-3 focus:outline-none focus:border-primary-container transition-colors rounded-none"
                      >
                        <option value="">-</option>
                        <option value="GK">GK</option>
                        <option value="DEF">DEF</option>
                        <option value="MID">MID</option>
                        <option value="FWD">FWD</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {roster.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-on-surface-variant font-label-caps text-[10px] uppercase tracking-widest">
                      NO PLAYERS IN ROSTER.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
