'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // We won't use this but keep import for now, or just remove it.
import { Clock, CalendarDays, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { TurfHero } from '@/components/shared/TurfHero';
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
    <div className="w-full h-full flex flex-col bg-background text-on-surface">
      {/* Header */}
      <TurfHero
        eyebrow={event.name}
        title={<>Tournament <span className="text-primary-container">Schedule</span></>}
        image="/turf/aerial-field.jpg"
        size="sm"
      />

      {/* Main Content */}
      <div className="flex-1 w-full bg-background px-margin-mobile md:px-gutter py-8">
        <div className="max-w-container-max mx-auto">
          {schedule.length === 0 ? (
            <div className="w-full border border-outline-variant bg-[#151816] flex flex-col items-center justify-center py-24 opacity-60">
              <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">calendar_month</span>
              <p className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-widest text-on-surface-variant">
                Schedule Finalizing
              </p>
              <p className="font-body-md text-on-surface-variant mt-2 text-sm uppercase tracking-widest">
                Check back later for fixtures
              </p>
            </div>
          ) : (
            <div className="flex flex-col border border-outline-variant bg-[#151816]">
              {schedule.map((match, index) => (
                <Link 
                  href={`/events/${slug}/matches/${match.id}`}
                  key={match.id} 
                  className={`flex flex-col md:flex-row md:items-stretch w-full group transition-colors hover:bg-surface-variant cursor-pointer block ${
                    index !== schedule.length - 1 ? 'border-b border-outline-variant' : ''
                  }`}
                >
                  {/* Match Info Column */}
                  <div className="flex md:flex-col justify-between md:justify-center p-4 md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-outline-variant bg-surface">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-on-surface-variant text-sm">schedule</span>
                      <span className="font-label-caps text-label-caps text-on-surface uppercase tabular-nums tracking-widest">
                        {format(new Date(match.scheduled_start), 'HH:mm')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0 md:mt-2">
                      <span className="material-symbols-outlined text-on-surface-variant text-sm">location_on</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase truncate max-w-[120px]">
                        {match.venue_field?.name || 'TBD'}
                      </span>
                    </div>
                  </div>

                  {/* Teams Column */}
                  <div className="flex-1 flex items-center justify-between p-4 md:p-6">
                    {/* Home Team */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-background border border-outline-variant flex items-center justify-center">
                        {match.home_team?.logo_media_id ? (
                          <img src={match.home_team.logo_media_id} alt="Logo" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                        ) : (
                          <span className="font-display-sm text-display-sm text-on-surface-variant uppercase">
                            {match.home_team?.team_short_name?.[0] || match.home_team?.team_name?.[0] || '?'}
                          </span>
                        )}
                      </div>
                      <span className="font-headline-lg-mobile md:text-2xl uppercase tracking-tighter text-on-surface group-hover:text-primary-container transition-colors line-clamp-1">
                        {match.home_team?.team_name || 'TBD'}
                      </span>
                    </div>

                    {/* VS divider */}
                    <div className="px-4 md:px-8 flex flex-col items-center justify-center shrink-0">
                      <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">VS</span>
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center justify-end gap-4 flex-1 text-right">
                      <span className="font-headline-lg-mobile md:text-2xl uppercase tracking-tighter text-on-surface group-hover:text-primary-container transition-colors line-clamp-1">
                        {match.away_team?.team_name || 'TBD'}
                      </span>
                      <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-background border border-outline-variant flex items-center justify-center">
                        {match.away_team?.logo_media_id ? (
                          <img src={match.away_team.logo_media_id} alt="Logo" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                        ) : (
                          <span className="font-display-sm text-display-sm text-on-surface-variant uppercase">
                            {match.away_team?.team_short_name?.[0] || match.away_team?.team_name?.[0] || '?'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
