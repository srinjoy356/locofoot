'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Clock, CalendarDays, MapPin } from 'lucide-react';

export default function PublicSchedulePage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  
  useEffect(() => {
    fetchEventAndSchedule();

    const matchesSubscription = supabase
      .channel('public:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, payload => {
        fetchEventAndSchedule();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchesSubscription);
    };
  }, [slug]);

  const fetchEventAndSchedule = async () => {
    try {
      let eventData = null;
      const { data: evBySlug } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
      if (evBySlug) {
        eventData = evBySlug;
      } else {
        const { data: evById } = await supabase.from('events').select('*').eq('id', slug).maybeSingle();
        eventData = evById;
      }
      
      if (!eventData) return;
      setEvent(eventData);

      const matchesRes = await supabase
        .from('matches')
        .select(`
          id,
          scheduled_start,
          status,
          home_team:event_team_registrations!home_registration_id(team_name, team_short_name, logo_media_id),
          away_team:event_team_registrations!away_registration_id(team_name, team_short_name, logo_media_id),
          venue_field:venue_fields(name)
        `)
        .eq('event_id', eventData.id)
        .eq('scheduling_status', 'ASSIGNED') // Only show assigned fixtures!
        .order('scheduled_start', { ascending: true });
        
      setSchedule(matchesRes.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  if (!event) return null;

  return (
    <div className="container max-w-5xl py-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-zinc-100 drop-shadow-sm">
          Tournament Schedule
        </h1>
        <p className="text-xl text-slate-500 dark:text-zinc-400 font-medium max-w-2xl mx-auto">
          {event.name}
        </p>
      </div>

      <div className="space-y-6">
        {schedule.length === 0 ? (
          <Card className="border-slate-200 dark:border-zinc-800 shadow-sm bg-slate-50 dark:bg-zinc-900/50/50">
            <CardContent className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
              <CalendarDays className="h-16 w-16 text-slate-300" />
              <p className="text-xl font-semibold text-slate-500 dark:text-zinc-400">The schedule is currently being finalized.</p>
              <p>Check back later or watch for live updates!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {schedule.map((match) => (
              <Card key={match.id} className="border-slate-200 dark:border-zinc-800/60 dark:border-zinc-800 shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-zinc-900 group overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                <CardHeader className="pb-3 bg-slate-50 dark:bg-zinc-900/50/50 dark:bg-zinc-800/50 border-b dark:border-zinc-800">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                      {new Date(match.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 bg-slate-200/50 dark:bg-zinc-800 px-2.5 py-1 rounded-full text-xs">
                      <MapPin className="h-3.5 w-3.5" />
                      {match.venue_field?.name || 'TBD'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-2 w-5/12 text-center">
                      <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 text-xs font-bold border-2 border-white dark:border-zinc-900 shadow-sm overflow-hidden">
                        {match.home_team?.logo_media_id ? (
                          <img src={match.home_team.logo_media_id} alt="Logo" className="w-full h-full object-cover" />
                        ) : 'TBD'}
                      </div>
                      <span className="font-bold text-slate-800 dark:text-zinc-100 line-clamp-2 leading-tight">
                        {match.home_team?.team_short_name || match.home_team?.team_name || 'TBD'}
                      </span>
                    </div>

                    <div className="w-2/12 flex justify-center">
                      <div className="bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 text-xs font-black px-2 py-1 rounded-md">VS</div>
                    </div>

                    <div className="flex flex-col items-center gap-2 w-5/12 text-center">
                      <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 text-xs font-bold border-2 border-white dark:border-zinc-900 shadow-sm overflow-hidden">
                        {match.away_team?.logo_media_id ? (
                          <img src={match.away_team.logo_media_id} alt="Logo" className="w-full h-full object-cover" />
                        ) : 'TBD'}
                      </div>
                      <span className="font-bold text-slate-800 dark:text-zinc-100 line-clamp-2 leading-tight">
                        {match.away_team?.team_short_name || match.away_team?.team_name || 'TBD'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
