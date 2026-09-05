"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Profile Form State
  const [profile, setProfile] = useState({
    bio: "",
    location_text: "",
    preferred_position: "",
    dominant_foot: "",
    date_of_birth: "",
    gender: "",
    phone: "",
    display_name: ""
  });

  // Privacy Form State
  const [privacy, setPrivacy] = useState({
    profile_public: true,
    stats_public: true,
    friends_visible: true,
    teams_visible: true,
    match_history_public: true,
    dm_permission: "EVERYONE"
  });

  useEffect(() => {
    async function loadSettings() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      setUserId(session.user.id);

      const [userRes, privacyRes] = await Promise.all([
        supabase.from("users").select("*").eq("id", session.user.id).single(),
        supabase.from("user_privacy_settings").select("*").eq("user_id", session.user.id).single()
      ]);

      if (userRes.data) {
        setProfile({
          bio: userRes.data.bio || "",
          location_text: userRes.data.location_text || "",
          preferred_position: userRes.data.preferred_position || "",
          dominant_foot: userRes.data.dominant_foot || "",
          date_of_birth: userRes.data.date_of_birth || "",
          gender: userRes.data.gender || "",
          phone: userRes.data.phone || "",
          display_name: userRes.data.display_name || ""
        });
      }

      if (privacyRes.data) {
        setPrivacy({
          profile_public: privacyRes.data.profile_public,
          stats_public: privacyRes.data.stats_public,
          friends_visible: privacyRes.data.friends_visible,
          teams_visible: privacyRes.data.teams_visible,
          match_history_public: privacyRes.data.match_history_public,
          dm_permission: privacyRes.data.dm_permission
        });
      }

      setLoading(false);
    }
    loadSettings();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    
    try {
      const [uRes, pRes] = await Promise.all([
        supabase.from("users").update({
          bio: profile.bio || null,
          location_text: profile.location_text || null,
          preferred_position: profile.preferred_position || null,
          dominant_foot: profile.dominant_foot || null,
          date_of_birth: profile.date_of_birth || null,
          gender: profile.gender || null,
          phone: profile.phone || null,
          display_name: profile.display_name || null
        }).eq("id", userId),
        
        supabase.from("user_privacy_settings").update({
          ...privacy
        }).eq("user_id", userId)
      ]);

      if (uRes.error) throw new Error(uRes.error.message);
      if (pRes.error) throw new Error(pRes.error.message);

      alert("Settings saved successfully!");
    } catch (err: any) {
      alert("Error saving settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 max-w-4xl mx-auto">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-8 text-slate-900 dark:text-white">Account Settings</h1>
      
      <form onSubmit={handleSave} className="space-y-12">
        {/* Profile Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 pb-2 border-b">Public Profile</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Display Name</label>
              <input 
                type="text" 
                value={profile.display_name} 
                onChange={e => setProfile({...profile, display_name: e.target.value})}
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Location</label>
              <input 
                type="text" 
                value={profile.location_text} 
                onChange={e => setProfile({...profile, location_text: e.target.value})}
                placeholder="e.g. London, UK"
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Bio</label>
              <textarea 
                value={profile.bio} 
                onChange={e => setProfile({...profile, bio: e.target.value})}
                rows={3}
                placeholder="Tell us about yourself..."
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
          </div>
        </div>

        {/* Football Stats Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 pb-2 border-b">Football Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Preferred Position</label>
              <select 
                value={profile.preferred_position} 
                onChange={e => setProfile({...profile, preferred_position: e.target.value})}
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
              >
                <option value="">Select Position</option>
                <option value="GK">Goalkeeper (GK)</option>
                <option value="DEF">Defender (DEF)</option>
                <option value="MID">Midfielder (MID)</option>
                <option value="FWD">Forward (FWD)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Strong Foot</label>
              <select 
                value={profile.dominant_foot} 
                onChange={e => setProfile({...profile, dominant_foot: e.target.value})}
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
              >
                <option value="">Select Foot</option>
                <option value="RIGHT">Right</option>
                <option value="LEFT">Left</option>
                <option value="BOTH">Both</option>
              </select>
            </div>
          </div>
        </div>

        {/* Private Info Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 pb-2 border-b">Private Information</h2>
          <p className="text-sm text-slate-500 mb-4">This information is never shown publicly.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Date of Birth</label>
              <input 
                type="date" 
                value={profile.date_of_birth} 
                onChange={e => setProfile({...profile, date_of_birth: e.target.value})}
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <input 
                type="tel" 
                value={profile.phone} 
                onChange={e => setProfile({...profile, phone: e.target.value})}
                placeholder="+1 234 567 8900"
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Gender</label>
              <select 
                value={profile.gender} 
                onChange={e => setProfile({...profile, gender: e.target.value})}
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
              >
                <option value="">Select Gender</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
                <option value="N">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        {/* Privacy Settings Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 pb-2 border-b">Privacy & Security</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Public Profile</h3>
                <p className="text-sm text-slate-500">Allow others to view your profile and bio.</p>
              </div>
              <input 
                type="checkbox" 
                checked={privacy.profile_public} 
                onChange={e => setPrivacy({...privacy, profile_public: e.target.checked})}
                className="w-5 h-5"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Public Stats</h3>
                <p className="text-sm text-slate-500">Allow others to see your football statistics.</p>
              </div>
              <input 
                type="checkbox" 
                checked={privacy.stats_public} 
                onChange={e => setPrivacy({...privacy, stats_public: e.target.checked})}
                className="w-5 h-5"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Show Match History</h3>
                <p className="text-sm text-slate-500">Display your past matches on your profile.</p>
              </div>
              <input 
                type="checkbox" 
                checked={privacy.match_history_public} 
                onChange={e => setPrivacy({...privacy, match_history_public: e.target.checked})}
                className="w-5 h-5"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Show Teams</h3>
                <p className="text-sm text-slate-500">Display the teams you are a member of.</p>
              </div>
              <input 
                type="checkbox" 
                checked={privacy.teams_visible} 
                onChange={e => setPrivacy({...privacy, teams_visible: e.target.checked})}
                className="w-5 h-5"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Show Friends</h3>
                <p className="text-sm text-slate-500">Display your friend list on your profile.</p>
              </div>
              <input 
                type="checkbox" 
                checked={privacy.friends_visible} 
                onChange={e => setPrivacy({...privacy, friends_visible: e.target.checked})}
                className="w-5 h-5"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
              <label className="block text-sm font-medium mb-2">Who can send you Direct Messages?</label>
              <select 
                value={privacy.dm_permission} 
                onChange={e => setPrivacy({...privacy, dm_permission: e.target.value})}
                className="w-full md:w-1/2 p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
              >
                <option value="EVERYONE">Everyone</option>
                <option value="FRIENDS">Friends Only</option>
                <option value="NONE">No One</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end sticky bottom-6 z-20">
          <button 
            type="submit" 
            disabled={saving}
            className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-lg font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
