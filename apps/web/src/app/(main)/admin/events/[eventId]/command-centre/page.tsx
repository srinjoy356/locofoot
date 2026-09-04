'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePresence } from '@/hooks/usePresence';
import { AlertTriangle, Clock, MapPin, Activity } from 'lucide-react';

export default function CommandCentrePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [matches, setMatches] = useState<any[]>([]);
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const supabase = createClient();
  const viewerCount = usePresence(eventId);

  const loadData = async () => {
    // Load live/scheduled matches with their venue/field info
    const { data } = await supabase
      .from('matches')
      .select(`
        id,
        match_state,
        home_score,
        away_score,
        home_team:event_team_registrations!home_registration_id(team_name),
        away_team:event_team_registrations!away_registration_id(team_name),
        schedule_slots(
          scheduled_start,
          scheduled_end,
          venues(name)
        )
      `)
      .eq('event_id', eventId)
      .in('match_state', ['READY', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2', 'PENALTIES', 'PAUSED'])
      .order('match_state');
    
    if (data) setMatches(data);
  };

  useEffect(() => {
    loadData();
    
    const channel = supabase
      .channel(`public:matches:event_id=eq.${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementMsg.trim()) return;
    
    if (isEmergency && !window.confirm("Are you sure you want to broadcast this as an EMERGENCY announcement? This will alert all viewers globally.")) {
      return;
    }

    setIsBroadcasting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/v1/events/${eventId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ message: announcementMsg, is_emergency: isEmergency })
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      alert("Announcement broadcasted successfully!");
      setAnnouncementMsg('');
      setIsEmergency(false);
    } catch (err: any) {
      alert("Error broadcasting: " + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold dark:text-zinc-100">Matchday Command Centre</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Live operational overview for the organizer.</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 px-4 py-2 rounded flex items-center gap-3 shadow-sm">
          <Activity className="text-green-500 w-5 h-5 animate-pulse" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Live Viewers</p>
            <p className="text-xl font-bold dark:text-zinc-100">{viewerCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Matches */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold dark:text-zinc-100">Live & Upcoming Matches</h2>
          {matches.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 p-8 text-center rounded border dark:border-zinc-800">
              <p className="text-gray-500 dark:text-zinc-400">No active matches at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map(m => {
                const venueName = Array.isArray(m.schedule_slots) 
                  ? m.schedule_slots[0]?.venues?.name 
                  : m.schedule_slots?.venues?.name;
                  
                return (
                  <div key={m.id} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded p-4 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span>{venueName || 'Unassigned Field'}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        ['FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'].includes(m.match_state) 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 animate-pulse'
                          : 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {m.match_state.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-center mt-4">
                      <div className="flex-1">
                        <p className="font-bold truncate dark:text-zinc-200" title={m.home_team?.team_name || 'TBD'}>
                          {m.home_team?.team_name || 'TBD'}
                        </p>
                      </div>
                      <div className="px-4">
                        <div className="text-2xl font-black bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded dark:text-zinc-100">
                          {m.home_score || 0} - {m.away_score || 0}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold truncate dark:text-zinc-200" title={m.away_team?.team_name || 'TBD'}>
                          {m.away_team?.team_name || 'TBD'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Broadcast */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold dark:text-zinc-100">Broadcast Announcer</h2>
          <form onSubmit={handleBroadcast} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded p-4 space-y-4 shadow-sm">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Message</label>
              <textarea 
                className="w-full border dark:border-zinc-700 p-2 rounded dark:bg-zinc-800 dark:text-white"
                rows={4}
                placeholder="Type an announcement to broadcast..."
                value={announcementMsg}
                onChange={e => setAnnouncementMsg(e.target.value)}
                required
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="isEmergency" 
                className="w-4 h-4 text-red-600"
                checked={isEmergency}
                onChange={e => setIsEmergency(e.target.checked)}
              />
              <label htmlFor="isEmergency" className="text-sm font-bold text-red-600 flex items-center gap-1 cursor-pointer">
                <AlertTriangle className="w-4 h-4" /> Emergency Broadcast
              </label>
            </div>
            
            <button 
              type="submit" 
              disabled={isBroadcasting}
              className={`w-full font-bold py-2 rounded text-white shadow-lg flex items-center justify-center gap-2 transition ${
                isEmergency ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {isBroadcasting ? 'Broadcasting...' : 'Broadcast Now'}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Pushes live immediately via Supabase Realtime to all viewers without polling.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
