"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ShareButton } from "@/components/shared/ShareButton";

export default function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [event, setEvent] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [eventUrl, setEventUrl] = useState("");
  const [scheduleTimeframe, setScheduleTimeframe] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
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
          .eq('event_id', ev.id);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, supabase]);
  
  if (!event) return <div>Loading public event...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-gray-100 dark:bg-zinc-900/50 p-8 rounded text-center relative border border-transparent dark:border-zinc-800">
        <div className="absolute top-4 right-4">
          <ShareButton url={eventUrl} title="Share Event" />
        </div>
        <h1 className="text-3xl font-bold dark:text-zinc-100">{event.name}</h1>
        <p className="text-gray-600 dark:text-zinc-400 mt-2">{event.description}</p>
        <div className="mt-4 flex justify-center gap-4">
          <div className="inline-block bg-white dark:bg-zinc-800 px-4 py-2 rounded shadow-sm text-sm font-semibold dark:text-zinc-200">
            Status: {event.status}
          </div>
          {scheduleTimeframe.start && scheduleTimeframe.end && (
            <div className="inline-block bg-white dark:bg-zinc-800 px-4 py-2 rounded shadow-sm text-sm font-semibold text-indigo-700 dark:text-indigo-400">
              Matches Scheduled: {scheduleTimeframe.start} to {scheduleTimeframe.end}
            </div>
          )}
        </div>
        
        {event.status === 'LIVE' && (
          <div className="mt-6 text-center">
            <Link href={`/events/${event.slug || event.id}/schedule`} className="inline-block bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-bold shadow-lg animate-pulse hover:animate-none flex items-center gap-2 justify-center mx-auto w-max">
              <span className="h-3 w-3 bg-white dark:bg-zinc-900 rounded-full block animate-ping mr-1"></span>
              Tournament is Live - Watch Matches
            </Link>
          </div>
        )}

        {event.status !== 'LIVE' && event.scheduling_state === 'LIVE' && (
          <div className="mt-6">
            <Link href={`/events/${event.slug || event.id}/schedule`} className="inline-block bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-bold shadow-lg animate-pulse hover:animate-none flex items-center gap-2 justify-center mx-auto w-max">
              <span className="h-3 w-3 bg-white dark:bg-zinc-900 rounded-full block animate-ping mr-1"></span>
              View Live Scheduling Broadcast
            </Link>
          </div>
        )}
        
        {event.status !== 'LIVE' && event.scheduling_state === 'COMPLETED' && (
          <div className="mt-6">
            <Link href={`/events/${event.slug || event.id}/schedule`} className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 justify-center mx-auto w-max">
              View Tournament Schedule
            </Link>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-700/50 rounded flex justify-between items-center">
          <p className="text-yellow-800 dark:text-yellow-500 text-sm">You are an admin for this event.</p>
          <Link href={`/admin/events/${event.id}`} className="bg-yellow-100 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-500 px-4 py-2 rounded text-sm font-bold border border-yellow-300 dark:border-yellow-700/50">
            Go to Admin Dashboard
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4 bg-white dark:bg-zinc-900 p-4 border dark:border-zinc-800 rounded">
        <h2 className="text-xl font-bold dark:text-zinc-100">Your Registrations</h2>
        
        {myRegistrations.length > 0 ? (
          <ul className="space-y-2">
            {myRegistrations.map((reg: any) => (
              <li key={reg.event_registration_id} className="flex justify-between items-center border dark:border-zinc-800 p-3 rounded">
                <div>
                  <div className="font-bold dark:text-zinc-200">{reg.event_team_registrations.team_name}</div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400">
                    Team Status: {reg.event_team_registrations.status} | Your Role: {reg.is_captain_for_event ? 'Captain' : 'Player'}
                  </div>
                </div>
                <Link 
                  href={`/events/${event.slug || event.id}/registrations/${reg.event_registration_id}`}
                  className="bg-gray-100 dark:bg-zinc-800 text-black dark:text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-200 dark:hover:bg-zinc-700"
                >
                  View Team
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-zinc-400 text-sm">You are not part of any team for this event yet.</p>
        )}

        {event.status === 'REGISTRATION_OPEN' ? (
          <div className="mt-4 pt-4 border-t dark:border-zinc-800">
            <Link 
              href={`/events/${event.slug || event.id}/register`}
              className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded inline-block font-medium"
            >
              Register a New Team
            </Link>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-zinc-400 mt-4 pt-4 border-t dark:border-zinc-800">Registration is closed or not yet open.</p>
        )}
      </div>

      
      <div className="flex flex-col gap-4 bg-white dark:bg-zinc-900 p-4 border dark:border-zinc-800 rounded mt-8">
        <h2 className="text-xl font-bold dark:text-zinc-100">Matches</h2>
        {matches.length > 0 ? (
          <ul className="space-y-2">
            {matches.map((m: any) => (
              <li key={m.id} className="flex justify-between items-center border dark:border-zinc-800 p-3 rounded hover:bg-slate-50 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/50 transition">
                <div>
                  <div className="font-bold dark:text-zinc-200">
                    {m.home_team?.team_name || 'TBD'} vs {m.away_team?.team_name || 'TBD'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">
                    State: {m.match_state}
                  </div>
                </div>
                <Link 
                  href={`/events/${event.slug || event.id}/matches/${m.id}`}
                  className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700"
                >
                  View Match Center
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-zinc-400 text-sm">No matches found for this event yet.</p>
        )}
      </div>

      <div className="mt-8 flex gap-4">

        <Link href={`/events/${event.slug || event.id}/teams`} className="text-blue-600 hover:underline">
          View Participating Teams →
        </Link>
        <Link href={`/events/${event.slug || event.id}/stats`} className="text-blue-600 hover:underline">
          View Statistics & Leaderboards →
        </Link>
      </div>
    </div>
  );
}
