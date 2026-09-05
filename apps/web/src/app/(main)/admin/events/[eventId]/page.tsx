"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Shield, Activity, Settings2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function EventDetailsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [refereeCode, setRefereeCode] = useState('');
  const [eventReferees, setEventReferees] = useState<any[]>([]);
  
  const [saving, setSaving] = useState(false);
  
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
      alert(`STATUS UPDATED TO ${status}`);
      loadData();
    } else {
      const err = await res.json();
      alert(`ERROR: ${JSON.stringify(err)}`);
    }
  }

  const handleInviteEventReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refereeCode) return;
    const codeUpper = refereeCode.trim().toUpperCase();
    if (eventReferees.find(r => r.user?.unique_code === codeUpper)) {
      alert("THIS USER IS ALREADY A REFEREE FOR THIS TOURNAMENT.");
      return;
    }
    try {
      const { error: rpcError } = await supabase.rpc('invite_event_referee', {
        p_event_id: eventId,
        p_unique_code: refereeCode.trim().toUpperCase()
      });
      if (rpcError) throw new Error(rpcError.message);
      alert(`REFEREE ROLE GRANTED TO ${refereeCode}!`);
      setRefereeCode('');
      loadData();
    } catch (err: any) {
      alert("ERROR: " + err.message);
    }
  };
  
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    // settings
    const setRes = await fetch(`/api/v1/events/${eventId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(settings)
    });
    
    if (!setRes.ok) {
      alert("FAILED TO SAVE SETTINGS: " + JSON.stringify(await setRes.json()));
      setSaving(false);
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
      alert("FAILED TO SAVE EVENT DETAILS: " + JSON.stringify(await evRes.json()));
      setSaving(false);
      return;
    }

    alert("SAVED!");
    setSaving(false);
    loadData();
  }

  if (!event) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest animate-pulse">LOADING TOURNAMENT SETTINGS...</div>
    </div>
  );

  return (
    <div className="w-full bg-background min-h-screen text-on-surface p-4 md:p-8 space-y-12">
      <div className="max-w-[1200px] mx-auto space-y-12">
        
        {/* Header & Status Control */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-outline-variant pb-6">
          <div>
            <h1 className="font-display-lg text-display-lg md:text-[56px] uppercase tracking-tighter leading-none">{event.name}</h1>
            <div className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mt-2 border border-outline-variant px-3 py-1 inline-block bg-surface">
              STATUS: <span className={event.status === 'LIVE' ? 'text-primary-container' : 'text-on-surface'}>{event.status}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => router.push(`/admin/events/${eventId}/registrations`)} className="bg-surface border border-outline-variant text-on-surface hover:bg-surface-variant px-6 py-3 font-label-caps text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2">
              <Users size={14} /> REGISTRATIONS
            </button>
            <button onClick={() => window.open(`/events/${event.slug || eventId}`, '_blank')} className="bg-surface border border-outline-variant text-on-surface hover:bg-surface-variant px-6 py-3 font-label-caps text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2">
              PUBLIC VIEW
            </button>
            
            {(event.status === 'DRAFT' || event.status === 'REGISTRATION_CLOSED') && (
              <button onClick={() => updateStatus('REGISTRATION_OPEN')} className="bg-primary-container text-on-primary-container hover:bg-primary-container/90 px-6 py-3 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                OPEN REGISTRATION
              </button>
            )}
            {event.status === 'REGISTRATION_OPEN' && (
              <button onClick={() => updateStatus('REGISTRATION_CLOSED')} className="bg-error text-on-error hover:bg-error/90 px-6 py-3 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                CLOSE REGISTRATION
              </button>
            )}
            {(event.status === 'REGISTRATION_CLOSED' || event.status === 'SCHEDULED' || event.status === 'SCHEDULING') && (
              <button onClick={() => updateStatus('LIVE')} className="bg-on-surface text-surface hover:bg-on-surface-variant px-6 py-3 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                LAUNCH TOURNAMENT (GO LIVE)
              </button>
            )}
            {event.status === 'LIVE' && (
              <button onClick={() => updateStatus('COMPLETED')} className="bg-on-surface text-surface hover:bg-on-surface-variant px-6 py-3 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                END TOURNAMENT (FINALIZE)
              </button>
            )}
          </div>
        </div>
        
        {/* Operations & Command Centre */}
        <div className="border border-outline-variant bg-surface">
          <div className="p-6 border-b border-outline-variant bg-surface-container flex items-center gap-3">
            <Activity className="text-on-surface" size={20} />
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">OPERATIONS & COMMAND CENTRE</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
            <button onClick={() => router.push(`/admin/events/${eventId}/command-centre`)} className="p-6 text-left hover:bg-primary-container/5 transition-colors group">
              <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface mb-2 group-hover:text-primary-container transition-colors">COMMAND CENTRE</h3>
              <p className="font-body-sm text-on-surface-variant">Live overview of all fields, broadcast announcements, and monitor active matches.</p>
            </button>
            
            <button onClick={() => router.push(`/admin/events/${eventId}/disciplinary`)} className="p-6 text-left hover:bg-error/5 transition-colors group">
              <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface mb-2 group-hover:text-error transition-colors">DISCIPLINARY</h3>
              <p className="font-body-sm text-on-surface-variant">Manage suspensions, yellow card accumulation, and red cards.</p>
            </button>

            <button onClick={() => router.push(`/admin/events/${eventId}/disputes`)} className="p-6 text-left hover:bg-surface-variant/50 transition-colors group">
              <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface mb-2 group-hover:text-on-surface-variant transition-colors">DISPUTES & REPORTS</h3>
              <p className="font-body-sm text-on-surface-variant">Resolve match disputes, correct match timelines, and review referee reports.</p>
            </button>
          </div>
        </div>

        {/* Schedule Management */}
        <div className="border border-outline-variant bg-surface">
          <div className="p-6 border-b border-outline-variant bg-surface-container flex items-center gap-3">
            <Clock className="text-on-surface" size={20} />
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">SCHEDULE MANAGEMENT</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
            <button onClick={() => router.push(`/admin/events/${eventId}/slots`)} className="p-6 text-left hover:bg-surface-variant/50 transition-colors group">
              <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface mb-2">1. SLOT CONFIGURATOR</h3>
              <p className="font-body-sm text-on-surface-variant">Define tournament slot timings before scheduling begins.</p>
            </button>
            
            <button onClick={() => router.push(`/admin/events/${eventId}/scheduling-live`)} className="p-6 text-left hover:bg-primary-container/5 transition-colors group">
              <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-primary-container mb-2">2. LIVE SCHEDULING</h3>
              <p className="font-body-sm text-on-surface-variant">Assign fixtures and broadcast live schedules to participants.</p>
            </button>
          </div>
        </div>
        
        {/* Referee Management */}
        <div className="border border-outline-variant bg-surface">
          <div className="p-6 border-b border-outline-variant bg-surface-container flex items-center gap-3">
            <Shield className="text-on-surface" size={20} />
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">REFEREE ROSTER</h2>
          </div>
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-outline-variant">
            <div className="flex-1 p-6">
              <p className="font-body-sm text-on-surface-variant mb-6">Grant referee status to users. Once granted, they can be assigned to matches.</p>
              <form onSubmit={handleInviteEventReferee} className="flex gap-4">
                <input 
                  type="text" 
                  placeholder="UNIQUE CODE (E.G. FTB-...)" 
                  className="bg-background border border-outline-variant text-on-surface font-mono text-sm p-3 focus:outline-none focus:border-primary-container flex-1 uppercase rounded-none placeholder:text-on-surface-variant/50"
                  value={refereeCode}
                  onChange={e => setRefereeCode(e.target.value)}
                />
                <button type="submit" className="bg-on-surface text-surface hover:bg-on-surface-variant px-6 font-label-caps text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center whitespace-nowrap">
                  GRANT ROLE
                </button>
              </form>
            </div>
            <div className="flex-1 p-0 bg-background">
              <div className="p-4 border-b border-outline-variant bg-surface-container">
                <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">TOURNAMENT REFEREES ({eventReferees.length})</h3>
              </div>
              {eventReferees.length === 0 ? (
                <div className="p-6 text-center font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  NO REFEREES ADDED YET.
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant">
                  {eventReferees.map(r => (
                    <li key={r.id} className="p-4 flex items-center justify-between hover:bg-surface-variant/30 transition-colors">
                      <span className="font-headline-sm uppercase tracking-tighter text-on-surface">
                        {((Array.isArray(r.user) ? r.user[0] : r.user)?.display_name) || ((Array.isArray(r.user) ? r.user[0] : r.user)?.username) || 'UNKNOWN USER'} 
                        <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant ml-4 border border-outline-variant px-2 py-0.5 bg-surface inline-block">
                          {(Array.isArray(r.user) ? r.user[0] : r.user)?.unique_code || 'NO CODE'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <form onSubmit={saveSettings} className="border border-outline-variant bg-surface">
          <div className="p-6 border-b border-outline-variant bg-surface-container flex items-center gap-3">
            <Settings2 className="text-on-surface" size={20} />
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">TOURNAMENT CONFIGURATION</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
            {/* Event Details */}
            <div className="p-6 space-y-6">
              <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface border-b border-outline-variant pb-2">BASIC DETAILS</h3>
              
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Description</label>
                <textarea 
                  className="w-full bg-background border border-outline-variant text-on-surface font-body-md p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors resize-none placeholder:text-on-surface-variant/50" 
                  rows={3}
                  value={event.description || ''} 
                  onChange={e => setEvent({...event, description: e.target.value})} 
                />
              </div>
              
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Venue</label>
                <select 
                  className="w-full bg-background border border-outline-variant text-on-surface font-label-caps text-[10px] uppercase tracking-widest p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors" 
                  value={event.venue_id || ''} 
                  onChange={e => setEvent({...event, venue_id: e.target.value})}
                >
                  <option value="">SELECT VENUE...</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Registration Deadline</label>
                <input 
                  type="datetime-local" 
                  className="w-full bg-background border border-outline-variant text-on-surface font-mono text-sm p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors" 
                  value={event.registration_deadline?.substring(0,16) || ''} 
                  onChange={e => setEvent({...event, registration_deadline: new Date(e.target.value).toISOString()})} 
                />
              </div>
            </div>

            {/* Match Settings */}
            <div className="p-6 space-y-6">
              <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface border-b border-outline-variant pb-2">MATCH RULES</h3>
              
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Format</label>
                <select 
                  className="w-full bg-background border border-outline-variant text-on-surface font-label-caps text-[10px] uppercase tracking-widest p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors" 
                  value={settings?.tournament_format || ''} 
                  onChange={e => setSettings({...settings, tournament_format: e.target.value})}
                >
                  <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                  <option value="KNOCKOUT">KNOCKOUT</option>
                </select>
              </div>
              
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Match Format / Timings</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="font-label-caps text-[8px] uppercase tracking-widest text-on-surface-variant block mb-1">HALF 1</span>
                    <input type="number" className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 text-center rounded-none focus:outline-none focus:border-primary-container transition-colors" value={settings?.first_half_minutes || ''} onChange={e => setSettings({...settings, first_half_minutes: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <span className="font-label-caps text-[8px] uppercase tracking-widest text-on-surface-variant block mb-1">HALF 2</span>
                    <input type="number" className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 text-center rounded-none focus:outline-none focus:border-primary-container transition-colors" value={settings?.second_half_minutes || ''} onChange={e => setSettings({...settings, second_half_minutes: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <span className="font-label-caps text-[8px] uppercase tracking-widest text-on-surface-variant block mb-1">BREAK</span>
                    <input type="number" className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 text-center rounded-none focus:outline-none focus:border-primary-container transition-colors" value={settings?.half_time_minutes || ''} onChange={e => setSettings({...settings, half_time_minutes: parseInt(e.target.value)})} />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Players on Field</label>
                  <input type="number" className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors" value={settings?.players_on_field || ''} onChange={e => setSettings({...settings, players_on_field: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Min Squad</label>
                  <input type="number" className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors" value={settings?.min_squad || ''} onChange={e => setSettings({...settings, min_squad: parseInt(e.target.value)})} />
                </div>
              </div>
              
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Max Substitutes Allowed</label>
                <input 
                  type="number" 
                  className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors mb-2" 
                  value={settings ? (settings.max_squad - (settings.players_on_field || 0)) : ''} 
                  onChange={e => setSettings({...settings, max_squad: (settings.players_on_field || 0) + parseInt(e.target.value)})} 
                />
                <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  TOTAL MAX SQUAD SIZE: <span className="text-on-surface">{settings?.max_squad || 0}</span>
                </p>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-outline-variant">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-5 h-5 border border-outline-variant bg-background group-hover:border-primary-container transition-colors">
                    <input type="checkbox" className="opacity-0 absolute inset-0 cursor-pointer" checked={settings?.allow_duplicate_jersey_numbers || false} onChange={e => setSettings({...settings, allow_duplicate_jersey_numbers: e.target.checked})} />
                    {settings?.allow_duplicate_jersey_numbers && <div className="w-3 h-3 bg-primary-container"></div>}
                  </div>
                  <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface">Allow Duplicate Jerseys</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-5 h-5 border border-outline-variant bg-background group-hover:border-primary-container transition-colors">
                    <input type="checkbox" className="opacity-0 absolute inset-0 cursor-pointer" checked={settings?.injury_time_tracking || false} onChange={e => setSettings({...settings, injury_time_tracking: e.target.checked})} />
                    {settings?.injury_time_tracking && <div className="w-3 h-3 bg-primary-container"></div>}
                  </div>
                  <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface">Stoppage Time Tracking UI</span>
                </label>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-outline-variant">
            <button type="submit" disabled={saving} className="w-full md:w-auto bg-primary-container text-on-primary-container hover:bg-primary-container/90 px-10 py-4 font-headline-sm uppercase tracking-tighter transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "SAVING..." : "SAVE ALL CHANGES"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
