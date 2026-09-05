"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurfHero } from "@/components/shared/TurfHero";

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
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      {/* Header */}
      <TurfHero
        eyebrow="Account"
        title="Settings"
        subtitle="Manage your profile, football details, and privacy preferences."
        image="/turf/pitch-lines.jpg"
        size="sm"
      />
      
      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8">
        <form onSubmit={handleSave} className="space-y-12">
          {/* Profile Section */}
          <div className="border border-outline-variant bg-surface p-6 md:p-12">
            <h2 className="font-headline-lg-mobile uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-4 mb-8">Public Profile</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Display Name</label>
                <input 
                  type="text" 
                  value={profile.display_name} 
                  onChange={e => setProfile({...profile, display_name: e.target.value})}
                  className="w-full p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors" 
                />
              </div>
              <div className="space-y-2">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Location</label>
                <input 
                  type="text" 
                  value={profile.location_text} 
                  onChange={e => setProfile({...profile, location_text: e.target.value})}
                  placeholder="e.g. London, UK"
                  className="w-full p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors" 
                />
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Bio</label>
                <textarea 
                  value={profile.bio} 
                  onChange={e => setProfile({...profile, bio: e.target.value})}
                  rows={3}
                  placeholder="Tell us about yourself..."
                  className="w-full p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors resize-y" 
                />
              </div>
            </div>
          </div>

          {/* Football Stats Section */}
          <div className="border border-outline-variant bg-surface p-6 md:p-12">
            <h2 className="font-headline-lg-mobile uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-4 mb-8">Football Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Preferred Position</label>
                <select 
                  value={profile.preferred_position} 
                  onChange={e => setProfile({...profile, preferred_position: e.target.value})}
                  className="w-full p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors"
                >
                  <option value="">Select Position</option>
                  <option value="GK">Goalkeeper (GK)</option>
                  <option value="DEF">Defender (DEF)</option>
                  <option value="MID">Midfielder (MID)</option>
                  <option value="FWD">Forward (FWD)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Strong Foot</label>
                <select 
                  value={profile.dominant_foot} 
                  onChange={e => setProfile({...profile, dominant_foot: e.target.value})}
                  className="w-full p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors"
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
          <div className="border border-outline-variant bg-surface p-6 md:p-12">
            <h2 className="font-headline-lg-mobile uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-4 mb-4">Private Information</h2>
            <p className="font-body-md text-on-surface-variant mb-8">This information is never shown publicly.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Date of Birth</label>
                <input 
                  type="date" 
                  value={profile.date_of_birth} 
                  onChange={e => setProfile({...profile, date_of_birth: e.target.value})}
                  className="w-full p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors" 
                />
              </div>
              <div className="space-y-2">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Phone Number</label>
                <input 
                  type="tel" 
                  value={profile.phone} 
                  onChange={e => setProfile({...profile, phone: e.target.value})}
                  placeholder="+1 234 567 8900"
                  className="w-full p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors" 
                />
              </div>
              <div className="space-y-2 md:col-span-2 max-w-md">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Gender</label>
                <select 
                  value={profile.gender} 
                  onChange={e => setProfile({...profile, gender: e.target.value})}
                  className="w-full p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors"
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
          <div className="border border-outline-variant bg-surface p-6 md:p-12">
            <h2 className="font-headline-lg-mobile uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-4 mb-8">Privacy & Security</h2>
            
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-outline-variant pb-6">
                <div>
                  <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">Public Profile</h3>
                  <p className="font-body-md text-on-surface-variant mt-1">Allow others to view your profile and bio.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={privacy.profile_public} 
                  onChange={e => setPrivacy({...privacy, profile_public: e.target.checked})}
                  className="w-6 h-6 border border-outline-variant bg-background checked:bg-primary-container checked:border-primary-container appearance-none transition-colors cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-on-primary-container checked:before:text-xs checked:before:left-1/2 checked:before:-translate-x-1/2 checked:before:top-1/2 checked:before:-translate-y-1/2 font-bold"
                />
              </div>

              <div className="flex items-center justify-between border-b border-outline-variant pb-6">
                <div>
                  <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">Public Stats</h3>
                  <p className="font-body-md text-on-surface-variant mt-1">Allow others to see your football statistics.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={privacy.stats_public} 
                  onChange={e => setPrivacy({...privacy, stats_public: e.target.checked})}
                  className="w-6 h-6 border border-outline-variant bg-background checked:bg-primary-container checked:border-primary-container appearance-none transition-colors cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-on-primary-container checked:before:text-xs checked:before:left-1/2 checked:before:-translate-x-1/2 checked:before:top-1/2 checked:before:-translate-y-1/2 font-bold"
                />
              </div>

              <div className="flex items-center justify-between border-b border-outline-variant pb-6">
                <div>
                  <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">Show Match History</h3>
                  <p className="font-body-md text-on-surface-variant mt-1">Display your past matches on your profile.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={privacy.match_history_public} 
                  onChange={e => setPrivacy({...privacy, match_history_public: e.target.checked})}
                  className="w-6 h-6 border border-outline-variant bg-background checked:bg-primary-container checked:border-primary-container appearance-none transition-colors cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-on-primary-container checked:before:text-xs checked:before:left-1/2 checked:before:-translate-x-1/2 checked:before:top-1/2 checked:before:-translate-y-1/2 font-bold"
                />
              </div>

              <div className="flex items-center justify-between border-b border-outline-variant pb-6">
                <div>
                  <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">Show Teams</h3>
                  <p className="font-body-md text-on-surface-variant mt-1">Display the teams you are a member of.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={privacy.teams_visible} 
                  onChange={e => setPrivacy({...privacy, teams_visible: e.target.checked})}
                  className="w-6 h-6 border border-outline-variant bg-background checked:bg-primary-container checked:border-primary-container appearance-none transition-colors cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-on-primary-container checked:before:text-xs checked:before:left-1/2 checked:before:-translate-x-1/2 checked:before:top-1/2 checked:before:-translate-y-1/2 font-bold"
                />
              </div>

              <div className="flex items-center justify-between border-b border-outline-variant pb-6">
                <div>
                  <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">Show Friends</h3>
                  <p className="font-body-md text-on-surface-variant mt-1">Display your friend list on your profile.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={privacy.friends_visible} 
                  onChange={e => setPrivacy({...privacy, friends_visible: e.target.checked})}
                  className="w-6 h-6 border border-outline-variant bg-background checked:bg-primary-container checked:border-primary-container appearance-none transition-colors cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-on-primary-container checked:before:text-xs checked:before:left-1/2 checked:before:-translate-x-1/2 checked:before:top-1/2 checked:before:-translate-y-1/2 font-bold"
                />
              </div>

              <div className="pt-4">
                <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-4">Who can send you Direct Messages?</label>
                <select 
                  value={privacy.dm_permission} 
                  onChange={e => setPrivacy({...privacy, dm_permission: e.target.value})}
                  className="w-full md:w-1/2 p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Friends Only</option>
                  <option value="NONE">No One</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end sticky bottom-6 z-20 md:static">
            <button 
              type="submit" 
              disabled={saving}
              className="w-full md:w-auto bg-primary-container text-on-primary-container px-12 py-4 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors disabled:opacity-50"
            >
              {saving ? 'SAVING...' : 'SAVE SETTINGS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
