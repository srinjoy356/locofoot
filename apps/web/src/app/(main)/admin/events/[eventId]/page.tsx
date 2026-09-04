"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function EventDetailsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [refereeCode, setRefereeCode] = useState('');
  const [eventReferees, setEventReferees] = useState<any[]>([]);
  
  const supabase = createClient();
  const router = useRouter();

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    // Load event
    const { data: evData } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (evData) setEvent(evData);

    // Load settings
    const { data: setData } = await supabase.from('event_settings').select('*').eq('event_id', eventId).single();
    if (setData) setSettings(setData);

    // Load venues
    const { data: vData } = await supabase.from('venues').select('*');
    if (vData) setVenues(vData);

    // Load referees
    const { data: rData } = await supabase.from('event_roles')
      .select('*, user:users!event_roles_user_id_fkey(*)')
      .eq('event_id', eventId)
      .eq('role', 'REFEREE');
    if (rData) setEventReferees(rData);
  }

  useEffect(() => { loadData(); }, [eventId, supabase]);

  async function updateStatus(status: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/v1/events/${eventId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      alert(`Status updated to ${status}`);
      loadData();
    } else {
      const err = await res.json();
      alert(`Error: ${JSON.stringify(err)}`);
    }
  }

  const handleInviteEventReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refereeCode) return;
    const codeUpper = refereeCode.trim().toUpperCase();
    if (eventReferees.find(r => r.user?.unique_code === codeUpper)) {
      alert("This user is already a referee for this tournament.");
      return;
    }
    try {
      const { error: rpcError } = await supabase.rpc('invite_event_referee', {
        p_event_id: eventId,
        p_unique_code: refereeCode.trim().toUpperCase()
      });
      if (rpcError) throw new Error(rpcError.message);
      alert(`Referee Role Granted to ${refereeCode}!`);
      setRefereeCode('');
      loadData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };
  
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    
    // settings
    const setRes = await fetch(`/api/v1/events/${eventId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(settings)
    });
    
    if (!setRes.ok) {
      alert("Failed to save settings: " + JSON.stringify(await setRes.json()));
      return;
    }

    // event
    const evRes = await fetch(`/api/v1/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        description: event.description,
        venue_id: event.venue_id === "" ? null : event.venue_id,
        start_date: event.start_date || null,
        end_date: event.end_date || null,
        registration_deadline: event.registration_deadline || null
      })
    });

    if (!evRes.ok) {
      alert("Failed to save event details: " + JSON.stringify(await evRes.json()));
      return;
    }

    alert("Saved!");
    loadData();
  }

  if (!event) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Status: {event.status}</p>
        </div>
        <div className="flex gap-2">
          {(event.status === 'DRAFT' || event.status === 'REGISTRATION_CLOSED') && (
            <button onClick={() => updateStatus('REGISTRATION_OPEN')} className="bg-green-600 text-white px-4 py-2 rounded">
              Open Registration
            </button>
          )}
          {event.status === 'REGISTRATION_OPEN' && (
            <button onClick={() => updateStatus('REGISTRATION_CLOSED')} className="bg-red-600 text-white px-4 py-2 rounded">
              Close Registration
            </button>
          )}
          {(event.status === 'REGISTRATION_CLOSED' || event.status === 'SCHEDULED' || event.status === 'SCHEDULING') && (
            <button onClick={() => updateStatus('LIVE')} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded shadow-lg">
              Launch Tournament (Go Live)
            </button>
          )}
          {event.status === 'LIVE' && (
            <button onClick={() => updateStatus('COMPLETED')} className="bg-emerald-600 text-white font-bold px-4 py-2 rounded shadow-lg">
              End Tournament (Finalize)
            </button>
          )}
          <button onClick={() => router.push(`/admin/events/${eventId}/registrations`)} className="bg-black text-white px-4 py-2 rounded">
            Manage Registrations
          </button>
        </div>
      </div>
      
      {/* Phase 6 Operations (Moved to Top for Visibility) */}
      <div className="bg-red-50 dark:bg-red-950/20 p-6 border border-red-200 dark:border-red-900/40 rounded">
        <h2 className="text-xl font-bold text-red-900 dark:text-red-400 mb-4">Operations & Command Centre</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => router.push(`/admin/events/${eventId}/command-centre`)} className="block text-left border rounded p-4 hover:shadow-md transition bg-white dark:bg-zinc-900 border-red-300 dark:border-zinc-800">
            <h3 className="font-bold text-red-700 dark:text-red-400">Matchday Command Centre</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Live overview of all fields, broadcast announcements, and monitor active matches.</p>
          </button>
          
          <button onClick={() => router.push(`/admin/events/${eventId}/disciplinary`)} className="block text-left border rounded p-4 hover:shadow-md transition bg-white dark:bg-zinc-900 border-amber-300 dark:border-zinc-800">
            <h3 className="font-bold text-amber-600 dark:text-amber-400">Disciplinary Dashboard</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage suspensions, yellow card accumulation, and red cards.</p>
          </button>

          <button onClick={() => router.push(`/admin/events/${eventId}/disputes`)} className="block text-left border rounded p-4 hover:shadow-md transition bg-white dark:bg-zinc-900 border-purple-300 dark:border-zinc-800">
            <h3 className="font-bold text-purple-600 dark:text-purple-400">Disputes & Reports</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Resolve match disputes, correct match timelines, and review referee reports.</p>
          </button>
        </div>
      </div>
      
      {/* Referee Management */}
      <div className="bg-amber-50 dark:bg-amber-950/30 p-6 border border-amber-200 dark:border-amber-900/50 rounded">
        <h2 className="text-xl font-bold text-amber-900 dark:text-amber-500 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> Referee Roster
        </h2>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <p className="text-sm text-amber-700 dark:text-amber-400/80 mb-2">Grant referee status to users for this tournament. Once granted, they can be assigned to individual matches.</p>
            <form onSubmit={handleInviteEventReferee} className="flex gap-2">
              <input 
                type="text" 
                placeholder="FTB-..." 
                className="border dark:border-zinc-700 p-2 rounded flex-1 uppercase dark:bg-zinc-800 dark:text-white"
                value={refereeCode}
                onChange={e => setRefereeCode(e.target.value)}
              />
              <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Grant Role
              </button>
            </form>
          </div>
          <div className="flex-1 bg-white dark:bg-zinc-900 rounded border border-amber-100 dark:border-zinc-800 p-4">
            <h3 className="font-semibold text-sm text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Tournament Referees ({eventReferees.length})</h3>
            {eventReferees.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No referees added yet.</p>
            ) : (
              <ul className="space-y-2">
                {eventReferees.map(r => (
                  <li key={r.id} className="text-sm font-medium flex items-center justify-between p-2 hover:bg-slate-50 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/50 rounded dark:text-zinc-200">
                    <span>
                      {((Array.isArray(r.user) ? r.user[0] : r.user)?.display_name) || ((Array.isArray(r.user) ? r.user[0] : r.user)?.username) || 'Unknown User'} 
                      <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">({(Array.isArray(r.user) ? r.user[0] : r.user)?.unique_code || 'No Code'})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Phase 3 Schedule Management */}
      <div className="bg-blue-50 dark:bg-blue-950/20 p-6 border border-blue-200 dark:border-blue-900/40 rounded">
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-400 mb-4">Schedule Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => router.push(`/admin/events/${eventId}/slots`)} className="block text-left border rounded p-4 hover:shadow-md transition bg-white dark:bg-zinc-900 border-blue-300 dark:border-zinc-800">
            <h3 className="font-bold text-blue-700 dark:text-blue-400">1. Slot Configurator</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Define tournament slot timings before scheduling begins.</p>
          </button>
          
          <button onClick={() => router.push(`/admin/events/${eventId}/scheduling-live`)} className="block text-left border rounded p-4 hover:shadow-md transition bg-white dark:bg-zinc-900 border-blue-300 dark:border-zinc-800">
            <h3 className="font-bold text-red-600 dark:text-red-400">2. Live Scheduling Command Center</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Assign fixtures and broadcast live schedules.</p>
          </button>
          
          <button onClick={() => window.open(`/events/${event.slug || eventId}`, '_blank')} className="block text-left border rounded p-4 hover:shadow-md transition bg-white dark:bg-zinc-900 border-blue-300 dark:border-zinc-800">
            <h3 className="font-bold text-emerald-600 dark:text-emerald-400">3. View Public Tournament Page</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">View the public site with standings and Match Centers.</p>
          </button>

          <button onClick={() => router.push(`/admin/events/${eventId}/matches/create`)} className="block text-left border rounded p-4 hover:shadow-md transition bg-white dark:bg-zinc-900 border-blue-300 dark:border-zinc-800">
            <h3 className="font-bold text-purple-600 dark:text-purple-400">4. Add Manual Match</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create a custom match linking specific teams and stages.</p>
          </button>
        </div>
      </div>

      <form onSubmit={saveSettings} className="grid grid-cols-2 gap-6 bg-white dark:bg-zinc-900 p-6 border dark:border-zinc-800 rounded">
        <div className="space-y-4">
          <h2 className="font-bold text-lg dark:text-zinc-100">Event Details</h2>
          <div>
            <label className="block text-sm dark:text-zinc-300">Description</label>
            <textarea className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={event.description || ''} onChange={e => setEvent({...event, description: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm dark:text-zinc-300">Venue</label>
            <select className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={event.venue_id || ''} onChange={e => setEvent({...event, venue_id: e.target.value})}>
              <option value="">Select Venue...</option>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm dark:text-zinc-300">Registration Deadline</label>
            <input type="datetime-local" className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={event.registration_deadline?.substring(0,16) || ''} onChange={e => setEvent({...event, registration_deadline: new Date(e.target.value).toISOString()})} />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-bold text-lg dark:text-zinc-100">Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm dark:text-zinc-300">Format</label>
              <select className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={settings?.tournament_format || ''} onChange={e => setSettings({...settings, tournament_format: e.target.value})}>
                <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                <option value="KNOCKOUT">KNOCKOUT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm dark:text-zinc-300">Match Format / Timings</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Half 1" className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={settings?.first_half_minutes || ''} onChange={e => setSettings({...settings, first_half_minutes: parseInt(e.target.value)})} title="First Half Minutes" />
                <input type="number" placeholder="Half 2" className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={settings?.second_half_minutes || ''} onChange={e => setSettings({...settings, second_half_minutes: parseInt(e.target.value)})} title="Second Half Minutes" />
                <input type="number" placeholder="Break" className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={settings?.half_time_minutes || ''} onChange={e => setSettings({...settings, half_time_minutes: parseInt(e.target.value)})} title="Half Time Minutes" />
              </div>
            </div>
            <div><label className="block text-sm dark:text-zinc-300">Players on Field</label><input type="number" className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={settings?.players_on_field || ''} onChange={e => setSettings({...settings, players_on_field: parseInt(e.target.value)})} /></div>
            <div><label className="block text-sm dark:text-zinc-300">Min Squad (Minimum to play)</label><input type="number" className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" value={settings?.min_squad || ''} onChange={e => setSettings({...settings, min_squad: parseInt(e.target.value)})} /></div>
            <div>
              <label className="block text-sm dark:text-zinc-300">Max Substitutes Allowed</label>
              <input 
                type="number" 
                className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white" 
                value={settings ? (settings.max_squad - (settings.players_on_field || 0)) : ''} 
                onChange={e => setSettings({...settings, max_squad: (settings.players_on_field || 0) + parseInt(e.target.value)})} 
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total max squad size will be: {settings?.max_squad || 0}
              </p>
            </div>
            <div>
              <label className="block text-sm dark:text-zinc-300">Duplicate Jerseys</label>
              <input type="checkbox" className="dark:bg-zinc-800" checked={settings?.allow_duplicate_jersey_numbers || false} onChange={e => setSettings({...settings, allow_duplicate_jersey_numbers: e.target.checked})} />
            </div>
            <div>
              <label className="block text-sm dark:text-zinc-300">Stoppage Time / Injury Time UI</label>
              <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer dark:text-zinc-300">
                <input type="checkbox" className="dark:bg-zinc-800" checked={settings?.injury_time_tracking || false} onChange={e => setSettings({...settings, injury_time_tracking: e.target.checked})} />
                Split added time visually (e.g. 30:00 + 02:00)
              </label>
            </div>
          </div>
        </div>

        <div className="col-span-2 border-t dark:border-zinc-800 pt-4">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save All Changes</button>
        </div>
      </form>
    </div>
  );
}
