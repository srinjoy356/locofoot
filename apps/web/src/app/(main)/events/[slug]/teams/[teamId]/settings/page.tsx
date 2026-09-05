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

  if (loading) return <div className="p-10 max-w-4xl mx-auto flex items-center gap-2"><RefreshCw className="animate-spin" /> Loading Settings...</div>;
  if (!team) return <div className="p-10 max-w-4xl mx-auto">Team not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/events/${slug}/teams/${regId}`} className="text-slate-500 hover:text-black">
          <ArrowLeft />
        </Link>
        <h1 className="text-2xl font-bold">Edit Team: {team.name}</h1>
      </div>

      {/* Team Details Form */}
      <form onSubmit={handleSaveTeam} className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow border dark:border-zinc-800 space-y-6">
        <h2 className="text-xl font-bold border-b pb-2">Team Details</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea 
              value={team.description || ''} 
              onChange={e => setTeam({...team, description: e.target.value})}
              rows={3}
              placeholder="About your team..."
              className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Instagram URL</label>
              <input 
                type="url" 
                value={team.instagram_url || ''} 
                onChange={e => setTeam({...team, instagram_url: e.target.value})}
                placeholder="https://instagram.com/..."
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Website URL</label>
              <input 
                type="url" 
                value={team.website_url || ''} 
                onChange={e => setTeam({...team, website_url: e.target.value})}
                placeholder="https://..."
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Primary Color (Hex)</label>
              <input 
                type="text" 
                value={team.primary_color || ''} 
                onChange={e => setTeam({...team, primary_color: e.target.value})}
                placeholder="#000000"
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secondary Color (Hex)</label>
              <input 
                type="text" 
                value={team.secondary_color || ''} 
                onChange={e => setTeam({...team, secondary_color: e.target.value})}
                placeholder="#FFFFFF"
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold flex items-center gap-2">
            <Save size={16} /> Save Team Details
          </button>
        </div>
      </form>

      {/* Roster Form */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow border dark:border-zinc-800 space-y-6">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-xl font-bold flex items-center gap-2"><Users size={20} /> Event Roster</h2>
          <button onClick={handleSaveRoster} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold flex items-center gap-2 text-sm">
            <Save size={16} /> Save Roster
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-zinc-700 text-sm">
                <th className="pb-2">Player</th>
                <th className="pb-2">Jersey #</th>
                <th className="pb-2">Position</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((player, idx) => (
                <tr key={player.id} className="border-b dark:border-zinc-800 last:border-0">
                  <td className="py-3">
                    <div className="font-semibold">{player.users?.display_name}</div>
                    <div className="text-xs text-slate-500">{player.users?.unique_code}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <input 
                      type="number" 
                      value={player.jersey_number || ''}
                      onChange={e => updateRosterPlayer(idx, 'jersey_number', e.target.value)}
                      className="w-20 p-1 border rounded text-center dark:bg-zinc-800 dark:border-zinc-700"
                      placeholder="-"
                    />
                  </td>
                  <td className="py-3">
                    <select 
                      value={player.position || ''}
                      onChange={e => updateRosterPlayer(idx, 'position', e.target.value)}
                      className="w-full p-1 border rounded dark:bg-zinc-800 dark:border-zinc-700"
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
