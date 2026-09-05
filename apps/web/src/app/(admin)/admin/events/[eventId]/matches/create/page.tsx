'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ArrowLeft, Trophy, CalendarPlus, AlertCircle, Clock } from 'lucide-react';
import { TurfHero } from '@/components/shared/TurfHero';

export default function CreateMatchPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teams, setTeams] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [brackets, setBrackets] = useState<any[]>([]);

  const [homeRegistrationId, setHomeRegistrationId] = useState<string>('');
  const [awayRegistrationId, setAwayRegistrationId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [bracketId, setBracketId] = useState<string>('');

  const [emptySlots, setEmptySlots] = useState<any[]>([]);
  const [slotAssignmentId, setSlotAssignmentId] = useState<string>('');

  const [useStandardFormat, setUseStandardFormat] = useState(true);
  const [firstHalf, setFirstHalf] = useState(45);
  const [secondHalf, setSecondHalf] = useState(45);
  const [halfTime, setHalfTime] = useState(15);

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      const [teamsRes, groupsRes, bracketsRes, slotsRes] = await Promise.all([
        supabase.from('event_team_registrations').select('id, team_name').eq('event_id', eventId).eq('status', 'APPROVED'),
        supabase.from('groups').select('*').eq('event_id', eventId),
        supabase.from('brackets').select('*').eq('event_id', eventId),
        supabase.from('slot_field_assignments').select('*, schedule_slots(*), venue_fields(*)').is('fixture_id', null).eq('schedule_slots.event_id', eventId)
      ]);
      setTeams(teamsRes.data || []);
      setGroups(groupsRes.data || []);
      setBrackets(bracketsRes.data || []);
      setEmptySlots((slotsRes.data || []).filter(s => s.schedule_slots !== null));
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    if (!homeRegistrationId || !awayRegistrationId) {
      setError('Please select both home and away teams.');
      return;
    }
    if (homeRegistrationId === awayRegistrationId) {
      setError('Home and away teams must be different.');
      return;
    }
    if (!slotAssignmentId) {
      setError('Please select a time slot.');
      return;
    }

    // Validation for custom time
    let metadata = undefined;
    if (!useStandardFormat) {
      const selectedSlot = emptySlots.find(s => s.id === slotAssignmentId);
      if (selectedSlot && selectedSlot.schedule_slots) {
        const start = new Date(selectedSlot.schedule_slots.scheduled_start).getTime();
        const end = new Date(selectedSlot.schedule_slots.scheduled_end).getTime();
        const slotMins = (end - start) / 60000;

        const formatMins = firstHalf + secondHalf + halfTime;
        if (formatMins > slotMins) {
          setError(`Match duration (${formatMins} mins) exceeds the selected slot duration (${slotMins} mins).`);
          return;
        }

        metadata = {
          first_half_minutes: firstHalf,
          second_half_minutes: secondHalf,
          half_time_minutes: halfTime
        };
      }
    }

    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const payload = {
        idempotency_key: crypto.randomUUID(),
        home_registration_id: homeRegistrationId,
        away_registration_id: awayRegistrationId,
        group_id: groupId || null,
        bracket_id: bracketId || null,
        slot_assignment_id: slotAssignmentId,
        metadata: metadata
      };

      const res = await fetch(`/api/v1/events/${eventId}/fixtures/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorMsg = "Failed to create match";
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          errorMsg = await res.text() || res.statusText;
        }
        throw new Error(errorMsg);
      }

      router.push(`/admin/events/${eventId}/scheduling-live`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      {/* Header */}
      <TurfHero
        eyebrow="Manual Fixture"
        title="Create Match"
        subtitle="Inject custom fixtures into the live tournament schedule."
        image="/turf/aerial-goal.jpg"
        size="sm"
      />

      <div className="w-full max-w-4xl mx-auto px-margin-mobile md:px-gutter py-8 space-y-8">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface font-label-caps text-label-caps uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {error && (
          <div className="border border-error bg-error/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-label-caps text-label-caps uppercase tracking-widest text-error">Error</h3>
              <p className="font-body-md text-error mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-surface border border-outline-variant overflow-hidden">

          <div className="p-6 md:p-8 space-y-10">
            {/* Teams Section */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="h-5 w-5 text-primary-container" />
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface">Select Teams</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">

                {/* VS Badge */}
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 bg-surface-container items-center justify-center font-label-caps text-label-caps text-on-surface-variant z-10 border border-outline-variant">
                  VS
                </div>

                <div className="space-y-3 bg-surface-container p-6 border border-outline-variant">
                  <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Home Team</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-background border border-outline-variant px-4 py-3.5 pr-10 text-on-surface font-body-md focus:outline-none focus:border-primary-container transition-colors"
                      value={homeRegistrationId}
                      onChange={(e) => setHomeRegistrationId(e.target.value)}
                    >
                      <option value="">Choose a team...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.team_name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 bg-surface-container p-6 border border-outline-variant">
                  <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Away Team</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-background border border-outline-variant px-4 py-3.5 pr-10 text-on-surface font-body-md focus:outline-none focus:border-primary-container transition-colors"
                      value={awayRegistrationId}
                      onChange={(e) => setAwayRegistrationId(e.target.value)}
                    >
                      <option value="">Choose a team...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.team_name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-outline-variant" />

            {/* Assignment Section */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <CalendarPlus className="h-5 w-5 text-primary-container" />
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface">Stage Assignment (Optional)</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                <div className="space-y-3">
                  <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Group (League phase)</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-background border border-outline-variant px-4 py-3.5 pr-10 text-on-surface font-body-md focus:outline-none focus:border-primary-container transition-colors"
                      value={groupId}
                      onChange={(e) => { setGroupId(e.target.value); setBracketId(''); }}
                    >
                      <option value="">None / Unassigned</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p className="font-body-md text-on-surface-variant px-1">Assign to a group to impact league standings.</p>
                </div>

                <div className="space-y-3">
                  <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Bracket (Knockout phase)</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-background border border-outline-variant px-4 py-3.5 pr-10 text-on-surface font-body-md focus:outline-none focus:border-primary-container transition-colors"
                      value={bracketId}
                      onChange={(e) => { setBracketId(e.target.value); setGroupId(''); }}
                    >
                      <option value="">None / Unassigned</option>
                      {brackets.map(b => (
                        <option key={b.id} value={b.id}>{b.round_name} (Pos {b.position})</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p className="font-body-md text-on-surface-variant px-1">Assign to a bracket node to advance tournament trees.</p>
                </div>

              </div>
            </div>

            <hr className="border-outline-variant" />

            {/* Slot & Format Assignment */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-primary-container" />
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface">Scheduling & Format</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Time Slot <span className="text-error">*</span></label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-background border border-outline-variant px-4 py-3.5 pr-10 text-on-surface font-body-md focus:outline-none focus:border-primary-container transition-colors"
                      value={slotAssignmentId}
                      onChange={(e) => setSlotAssignmentId(e.target.value)}
                    >
                      <option value="">Choose an available slot...</option>
                      {emptySlots.map(s => {
                        const start = new Date(s.schedule_slots.scheduled_start);
                        const end = new Date(s.schedule_slots.scheduled_end);
                        const mins = (end.getTime() - start.getTime()) / 60000;
                        return (
                          <option key={s.id} value={s.id}>
                            Slot {s.schedule_slots.sequence_number} | {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ({mins} mins) @ {s.venue_fields?.field_name || 'Pitch'}
                          </option>
                        );
                      })}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p className="font-body-md text-on-surface-variant px-1">Mandatory. Match will immediately drop into this grid block.</p>
                </div>

                <div className="bg-surface-container border border-outline-variant p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="standardFormat"
                      checked={useStandardFormat}
                      onChange={(e) => setUseStandardFormat(e.target.checked)}
                      className="w-5 h-5 border border-outline-variant bg-background accent-primary-container"
                    />
                    <label htmlFor="standardFormat" className="font-body-md text-on-surface cursor-pointer">
                      Use standard tournament time format
                    </label>
                  </div>

                  {!useStandardFormat && (
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-outline-variant mt-4">
                      <div className="space-y-2">
                        <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">1st Half (mins)</label>
                        <input type="number" value={firstHalf} onChange={e => setFirstHalf(Number(e.target.value))} className="w-full bg-background border border-outline-variant px-3 py-2 font-mono text-on-surface focus:outline-none focus:border-primary-container transition-colors" />
                      </div>
                      <div className="space-y-2">
                        <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">2nd Half (mins)</label>
                        <input type="number" value={secondHalf} onChange={e => setSecondHalf(Number(e.target.value))} className="w-full bg-background border border-outline-variant px-3 py-2 font-mono text-on-surface focus:outline-none focus:border-primary-container transition-colors" />
                      </div>
                      <div className="space-y-2">
                        <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Half-Time (mins)</label>
                        <input type="number" value={halfTime} onChange={e => setHalfTime(Number(e.target.value))} className="w-full bg-background border border-outline-variant px-3 py-2 font-mono text-on-surface focus:outline-none focus:border-primary-container transition-colors" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container p-6 md:p-8 border-t border-outline-variant flex justify-end">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-primary-container text-on-primary-container font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Confirm & Create Match
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
