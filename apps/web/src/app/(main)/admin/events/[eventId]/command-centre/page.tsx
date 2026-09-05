'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePresence } from '@/hooks/usePresence';
import { AlertTriangle, MapPin, Activity, Radio, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
    
    if (isEmergency && !window.confirm("ARE YOU SURE YOU WANT TO BROADCAST THIS AS AN EMERGENCY ANNOUNCEMENT? THIS WILL ALERT ALL VIEWERS GLOBALLY.")) {
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
      
      alert("ANNOUNCEMENT BROADCASTED SUCCESSFULLY!");
      setAnnouncementMsg('');
      setIsEmergency(false);
    } catch (err: any) {
      alert("ERROR BROADCASTING: " + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="w-full bg-background min-h-[calc(100vh-64px)] text-on-surface">
      
      {/* Top Bar */}
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center justify-between">
          <Link href={`/admin/events/${eventId}`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft size={16} />
            <span className="font-label-caps text-label-caps uppercase tracking-widest">EVENT DASHBOARD</span>
          </Link>
          
          <div className="flex items-center gap-2 border border-outline-variant px-3 py-1 bg-background">
            <Activity size={12} className="text-primary-container animate-pulse" />
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
              LIVE VIEWERS: <span className="text-on-surface">{viewerCount}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-margin-mobile md:px-gutter py-8 space-y-12">
        <div className="relative overflow-hidden border border-outline-variant bg-[#151816]">
          <div className="absolute inset-0 z-0">
            <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-25 " src="/turf/aerial-goal.jpg" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40 z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          </div>
          <div className="relative z-20 p-6 md:p-8">
            <span className="mb-3 flex items-center gap-2 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]" />
              Live Operations
            </span>
            <h1 className="font-display-lg text-display-lg md:text-[56px] uppercase tracking-tighter leading-none text-on-surface">
              COMMAND CENTRE
            </h1>
            <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 max-w-xl">
              MONITOR LIVE MATCHES AND BROADCAST ANNOUNCEMENTS ACROSS THE TOURNAMENT.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Live Matches */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface flex items-center gap-2">
              <span className="w-2 h-2 bg-primary-container inline-block"></span>
              LIVE & UPCOMING MATCHES
            </h2>
            
            {matches.length === 0 ? (
              <div className="border border-outline-variant bg-surface p-12 text-center">
                <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                  NO ACTIVE MATCHES AT THE MOMENT.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {matches.map(m => {
                  const venueName = Array.isArray(m.schedule_slots) 
                    ? m.schedule_slots[0]?.venues?.name 
                    : m.schedule_slots?.venues?.name;
                    
                  const isLive = ['FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2', 'PENALTIES'].includes(m.match_state);
                    
                  return (
                    <div key={m.id} className={`bg-surface border relative transition-colors ${isLive ? 'border-primary-container' : 'border-outline-variant'}`}>
                      {/* Match Header */}
                      <div className={`p-3 flex justify-between items-center border-b ${isLive ? 'border-primary-container bg-primary-container/10' : 'border-outline-variant bg-surface-container'}`}>
                        <div className="flex items-center gap-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                          <MapPin size={10} />
                          <span>{venueName || 'UNASSIGNED FIELD'}</span>
                        </div>
                        <span className={`font-label-caps text-[10px] uppercase tracking-widest px-2 py-0.5 border ${
                          isLive 
                            ? 'bg-primary-container text-on-primary-container border-primary-container animate-pulse'
                            : 'bg-surface-variant text-on-surface-variant border-outline-variant'
                        }`}>
                          {m.match_state.replace(/_/g, ' ')}
                        </span>
                      </div>
                      
                      {/* Scoreboard */}
                      <div className="p-6">
                        <div className="grid grid-cols-3 items-center text-center gap-4">
                          <div className="font-headline-sm uppercase tracking-tighter text-on-surface truncate" title={m.home_team?.team_name || 'TBD'}>
                            {m.home_team?.team_name || 'TBD'}
                          </div>
                          
                          <div className="flex justify-center">
                            <div className="bg-background border border-outline-variant px-4 py-2 font-display-sm text-[32px] tracking-tighter text-on-surface tabular-nums leading-none">
                              {m.home_score || 0} - {m.away_score || 0}
                            </div>
                          </div>
                          
                          <div className="font-headline-sm uppercase tracking-tighter text-on-surface truncate" title={m.away_team?.team_name || 'TBD'}>
                            {m.away_team?.team_name || 'TBD'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Broadcast */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface flex items-center gap-2">
              <Radio size={16} />
              BROADCAST ANNOUNCER
            </h2>
            
            <form onSubmit={handleBroadcast} className="border border-outline-variant bg-surface p-6 space-y-6">
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Message</label>
                <textarea 
                  className="w-full bg-background border border-outline-variant text-on-surface font-body-md p-4 rounded-none focus:outline-none focus:border-primary-container transition-colors resize-none placeholder:text-on-surface-variant/50"
                  rows={5}
                  placeholder="TYPE AN ANNOUNCEMENT TO BROADCAST..."
                  value={announcementMsg}
                  onChange={e => setAnnouncementMsg(e.target.value)}
                  required
                />
              </div>
              
              <label className="flex items-center gap-3 cursor-pointer group p-3 border border-outline-variant bg-background hover:border-error transition-colors">
                <div className="relative flex items-center justify-center w-5 h-5 border border-outline-variant bg-background group-hover:border-error transition-colors">
                  <input 
                    type="checkbox" 
                    className="opacity-0 absolute inset-0 cursor-pointer"
                    checked={isEmergency}
                    onChange={e => setIsEmergency(e.target.checked)}
                  />
                  {isEmergency && <div className="w-3 h-3 bg-error"></div>}
                </div>
                <AlertTriangle size={14} className={isEmergency ? "text-error" : "text-on-surface-variant group-hover:text-error transition-colors"} />
                <span className={`font-label-caps text-[10px] uppercase tracking-widest ${isEmergency ? "text-error" : "text-on-surface group-hover:text-error transition-colors"}`}>
                  EMERGENCY BROADCAST
                </span>
              </label>
              
              <div className="pt-2 border-t border-outline-variant space-y-4">
                <button 
                  type="submit" 
                  disabled={isBroadcasting || !announcementMsg.trim()}
                  className={`w-full font-headline-sm uppercase tracking-tighter py-4 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isEmergency 
                      ? 'bg-error text-on-error hover:bg-error/90' 
                      : 'bg-primary-container text-on-primary-container hover:bg-primary-container/90'
                  }`}
                >
                  {isBroadcasting ? 'BROADCASTING...' : 'BROADCAST NOW'}
                </button>
                <p className="font-label-caps text-[10px] uppercase tracking-widest text-center text-on-surface-variant">
                  PUSHES LIVE VIA SUPABASE REALTIME.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
