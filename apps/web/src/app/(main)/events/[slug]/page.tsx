"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ShareButton } from "@/components/shared/ShareButton";
import { QRCodeBlock } from "@/components/shared/QRCodeBlock";
import { usePresence } from "@/hooks/usePresence";

export default function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [event, setEvent] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [eventUrl, setEventUrl] = useState("");
  const [scheduleTimeframe, setScheduleTimeframe] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
  const viewers = usePresence(event?.id);
  const supabase = createClient();

  useEffect(() => {
    setEventUrl(window.location.href);
    
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      
      let ev = null;
      const { data } = await supabase.from('events').select('*').eq('id', slug).single();
      if (data) ev = data;
      else {
        const { data: bySlug } = await supabase.from('events').select('*').eq('slug', slug).single();
        if (bySlug) ev = bySlug;
      }
      setEvent(ev);

      
      if (ev) {
        // Fetch matches
        const { data: matchData } = await supabase
          .from('matches')
          .select(`
            id,
            match_state,
            home_team:event_team_registrations!home_registration_id(team_name),
            away_team:event_team_registrations!away_registration_id(team_name)
          `)
          .eq('event_id', ev.id)
          .eq('scheduling_status', 'ASSIGNED')
          .order('scheduled_start', { ascending: true, nullsFirst: false });
        if (matchData) setMatches(matchData);

        if (ev.slot_structure_state === 'FINALIZED') {
          const { data: slots } = await supabase.from('schedule_slots').select('scheduled_start, scheduled_end').eq('event_id', ev.id);
          if (slots && slots.length > 0) {
            const startDates = slots.map((s: any) => new Date(s.scheduled_start).getTime());
            const endDates = slots.map((s: any) => new Date(s.scheduled_end).getTime());
            
            const minStart = new Date(Math.min(...startDates)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            const maxEnd = new Date(Math.max(...endDates)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            setScheduleTimeframe({ start: minStart, end: maxEnd });
          }
        }

        // Fetch latest announcement (emergency or not)
        const { data: annData } = await supabase
          .from('event_announcements')
          .select('*')
          .eq('event_id', ev.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (annData) setAnnouncement(annData);

        if (session) {
        // Load admin status
        const { data: roleData } = await supabase.from('event_roles')
          .select('role')
          .eq('event_id', ev.id)
          .eq('user_id', session.user.id)
          .in('role', ['EVENT_OWNER', 'EVENT_ADMIN'])
          .maybeSingle();
        if (roleData) setIsAdmin(true);

        // Load user's registrations for this event
        const { data: myTeams } = await supabase
          .from('event_team_players')
          .select(`
            event_registration_id,
            status,
            is_captain_for_event,
            event_team_registrations!inner (
              id,
              team_name,
              status,
              event_id
            )
          `)
          .eq('user_id', session.user.id)
          .eq('event_team_registrations.event_id', ev.id);
        
        if (myTeams) setMyRegistrations(myTeams);
      }
    }
  }
  load();

    const channel = supabase
      .channel('public:events_status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, payload => {
        setEvent((prev: any) => {
          if (prev && prev.id === payload.new.id) {
            return { ...prev, ...payload.new };
          }
          return prev;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_announcements' }, payload => {
        setAnnouncement(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, supabase]);
  
  if (!event) return <div>Loading public event...</div>;

  return (
    <div className="w-full h-full flex flex-col bg-background text-on-surface">
      {announcement && (
        <div className={`p-4 border-b border-outline-variant flex items-center gap-4 ${announcement.is_emergency ? 'bg-error text-on-error' : 'bg-primary-container text-on-primary-container'} animate-in fade-in slide-in-from-top-4`}>
          <div className="flex-shrink-0 animate-pulse">
            <span className="material-symbols-outlined text-2xl">{announcement.is_emergency ? 'warning' : 'info'}</span>
          </div>
          <div className="flex-1">
            <h3 className="font-label-caps text-label-caps uppercase tracking-widest">{announcement.is_emergency ? 'EMERGENCY ANNOUNCEMENT' : 'ANNOUNCEMENT'}</h3>
            <p className="font-body-md mt-1">{announcement.message}</p>
          </div>
          <button onClick={() => setAnnouncement(null)} className="font-display-lg text-2xl leading-none opacity-50 hover:opacity-100">&times;</button>
        </div>
      )}

      {/* Hero Header */}
      <div className="w-full bg-[#151816] border-b border-outline-variant relative shrink-0 overflow-hidden min-h-[320px] flex flex-col justify-end pt-24 pb-12 px-margin-mobile md:px-gutter text-center">
        <div className="absolute inset-0 z-0">
          <img alt="" aria-hidden="true" className="w-full h-full object-cover  opacity-45 " src="/turf/aerial-goal.jpg" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent z-10 pointer-events-none"></div>
        <div className="absolute top-4 right-4 z-20">
          <ShareButton url={eventUrl} title="Share Event" />
        </div>
        
        <div className="relative z-20 max-w-container-max mx-auto w-full">
          <h1 className="font-display-lg text-display-lg md:text-[64px] uppercase tracking-tighter leading-none text-on-surface mb-2">{event.name}</h1>
          <p className="font-body-lg text-on-surface-variant max-w-2xl mx-auto">{event.description}</p>
          
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <div className="border border-outline-variant bg-surface px-4 py-2 font-label-caps text-[10px] text-on-surface uppercase tracking-widest">
              Status: {event.status}
            </div>
            <div className="border border-outline-variant bg-surface px-4 py-2 font-label-caps text-[10px] text-on-surface uppercase tracking-widest flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
              </span>
              {viewers} Live Viewers
            </div>
            {scheduleTimeframe.start && scheduleTimeframe.end && (
              <div className="border border-primary-container bg-primary-container/10 px-4 py-2 font-label-caps text-[10px] text-primary-container uppercase tracking-widest">
                Matches: {scheduleTimeframe.start} to {scheduleTimeframe.end}
              </div>
            )}
          </div>
          
          {event.status === 'LIVE' && (
            <div className="mt-8 flex justify-center">
              <Link href={`/events/${event.slug || event.id}/schedule`} className="border border-error bg-error/10 hover:bg-error/20 text-error px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors flex items-center gap-2">
                <span className="h-2 w-2 bg-error rounded-full block animate-ping"></span>
                Tournament is Live - Watch Matches
              </Link>
            </div>
          )}

          {event.status !== 'LIVE' && event.scheduling_state === 'LIVE' && (
            <div className="mt-8 flex justify-center">
              <Link href={`/events/${event.slug || event.id}/schedule`} className="border border-error bg-error/10 hover:bg-error/20 text-error px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors flex items-center gap-2">
                <span className="h-2 w-2 bg-error rounded-full block animate-ping"></span>
                View Live Scheduling Broadcast
              </Link>
            </div>
          )}
          
          {event.status !== 'LIVE' && event.scheduling_state === 'COMPLETED' && (
            <div className="mt-8 flex justify-center">
              <Link href={`/events/${event.slug || event.id}/schedule`} className="border border-primary-container bg-primary-container/10 hover:bg-primary-container/20 text-primary-container px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors">
                View Tournament Schedule
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 md:py-12 flex-1 space-y-12">
        
        {isAdmin && (
          <div className="border border-yellow-500/50 bg-yellow-500/5 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-label-caps text-label-caps text-yellow-500 uppercase tracking-widest">You are an admin for this event.</p>
            <Link href={`/admin/events/${event.id}`} className="border border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-500 px-4 py-2 font-label-caps text-label-caps uppercase tracking-widest transition-colors">
              Admin Dashboard
            </Link>
          </div>
        )}

        {event.rules && (
          <div className="border-t border-outline-variant pt-8">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface mb-6">Tournament Rules</h2>
            <div className="bg-surface border border-outline-variant p-6">
              <p className="font-body-md text-on-surface-variant whitespace-pre-wrap">{event.rules}</p>
            </div>
          </div>
        )}

        <div className="border-t border-outline-variant pt-8">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface mb-6">Your Registrations</h2>
          
          {myRegistrations.length > 0 ? (
            <div className="grid grid-cols-1 border border-outline-variant bg-surface divide-y divide-outline-variant">
              {myRegistrations.map((reg: any) => (
                <div key={reg.event_registration_id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-surface-variant transition-colors">
                  <div>
                    <div className="font-headline-lg-mobile text-on-surface uppercase tracking-tighter">{reg.event_team_registrations.team_name}</div>
                    <div className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                      Status: {reg.event_team_registrations.status} <span className="mx-2">|</span> Role: {reg.is_captain_for_event ? 'Captain' : 'Player'}
                    </div>
                  </div>
                  <Link 
                    href={`/events/${event.slug || event.id}/registrations/${reg.event_registration_id}`}
                    className="border border-outline-variant bg-surface hover:bg-surface-variant px-4 py-2 font-label-caps text-[10px] text-on-surface uppercase tracking-widest transition-colors"
                  >
                    View Team
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant italic">You are not part of any team for this event yet.</p>
          )}

          {event.status === 'REGISTRATION_OPEN' ? (
            <div className="mt-6">
              <Link 
                href={`/events/${event.slug || event.id}/register`}
                className="border border-outline-variant bg-surface hover:bg-surface-variant px-6 py-4 font-label-caps text-label-caps text-on-surface uppercase tracking-widest transition-colors inline-block"
              >
                Register a New Team
              </Link>
            </div>
          ) : (
            <p className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mt-6 opacity-60">Registration is closed or not yet open.</p>
          )}
        </div>

        <div className="border-t border-outline-variant pt-8">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface mb-6">Upcoming & Live Matches</h2>
          {matches.length > 0 ? (
            <div className="grid grid-cols-1 border border-outline-variant bg-surface divide-y divide-outline-variant">
              {matches.map((m: any) => (
                <div key={m.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-surface-variant transition-colors">
                  <div>
                    <div className="font-headline-lg-mobile text-on-surface uppercase tracking-tighter">
                      {m.home_team?.team_name || 'TBD'} <span className="text-on-surface-variant mx-2 text-sm font-sans">vs</span> {m.away_team?.team_name || 'TBD'}
                    </div>
                    <div className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                      State: {m.match_state.replace('_', ' ')}
                    </div>
                  </div>
                  <Link 
                    href={`/events/${event.slug || event.id}/matches/${m.id}`}
                    className="border border-primary-container text-primary-container hover:bg-primary-container/10 px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors"
                  >
                    Match Center
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant italic">No matches scheduled yet.</p>
          )}
        </div>

        <div className="border-t border-outline-variant pt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href={`/events/${event.slug || event.id}/teams`} className="border border-outline-variant bg-surface hover:bg-surface-variant px-6 py-6 font-label-caps text-label-caps text-on-surface uppercase tracking-widest transition-colors flex justify-between items-center group">
            View Teams <span className="material-symbols-outlined opacity-50 group-hover:opacity-100 transition-opacity">arrow_forward</span>
          </Link>
          <Link href={`/events/${event.slug || event.id}/stats`} className="border border-outline-variant bg-surface hover:bg-surface-variant px-6 py-6 font-label-caps text-label-caps text-on-surface uppercase tracking-widest transition-colors flex justify-between items-center group">
            View Statistics <span className="material-symbols-outlined opacity-50 group-hover:opacity-100 transition-opacity">arrow_forward</span>
          </Link>
        </div>

        <div className="flex justify-center py-12">
          <QRCodeBlock url={`/events/${event.slug || event.id}`} title="Event QR Code" />
        </div>
      </div>
    </div>
  );
}
