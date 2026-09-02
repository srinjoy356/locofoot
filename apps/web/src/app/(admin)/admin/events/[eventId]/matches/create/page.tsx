'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Trophy, CalendarPlus, AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 p-4 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()} 
            className="rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 h-10 w-10 flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              Create Manual Match
            </h1>
            <p className="text-slate-500 dark:text-zinc-400 mt-1 font-medium text-sm">
              Inject custom fixtures into the live tournament schedule.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-300 font-bold">Error</AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-400 font-medium">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl shadow-indigo-100/20 dark:shadow-black/40 border border-slate-100 dark:border-zinc-800/80 overflow-hidden">
          
          <div className="p-8 space-y-10">
            {/* Teams Section */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="h-5 w-5 text-indigo-500" />
                <h2 className="text-xl font-bold">Select Teams</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                
                {/* VS Badge */}
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 bg-slate-100 dark:bg-zinc-800 rounded-full items-center justify-center font-bold text-sm text-slate-400 dark:text-zinc-500 z-10 border-4 border-white dark:border-zinc-900 shadow-sm">
                  VS
                </div>

                <div className="space-y-3 bg-slate-50 dark:bg-zinc-950/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                  <label className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Home Team</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3.5 pr-10 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm"
                      value={homeRegistrationId}
                      onChange={(e) => setHomeRegistrationId(e.target.value)}
                    >
                      <option value="">Choose a team...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.team_name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 dark:text-zinc-400">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 bg-slate-50 dark:bg-zinc-950/50 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                  <label className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Away Team</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3.5 pr-10 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm"
                      value={awayRegistrationId}
                      onChange={(e) => setAwayRegistrationId(e.target.value)}
                    >
                      <option value="">Choose a team...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.team_name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 dark:text-zinc-400">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-zinc-800" />

            {/* Assignment Section */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <CalendarPlus className="h-5 w-5 text-purple-500" />
                <h2 className="text-xl font-bold">Stage Assignment (Optional)</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Group (League phase)</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 pr-10 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      value={groupId}
                      onChange={(e) => { setGroupId(e.target.value); setBracketId(''); }}
                    >
                      <option value="">None / Unassigned</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 dark:text-zinc-500">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 px-1">Assign to a group to impact league standings.</p>
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Bracket (Knockout phase)</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 pr-10 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      value={bracketId}
                      onChange={(e) => { setBracketId(e.target.value); setGroupId(''); }}
                    >
                      <option value="">None / Unassigned</option>
                      {brackets.map(b => (
                        <option key={b.id} value={b.id}>{b.round_name} (Pos {b.position})</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 dark:text-zinc-500">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 px-1">Assign to a bracket node to advance tournament trees.</p>
                </div>
                
              </div>
            </div>
            
            <hr className="border-slate-100 dark:border-zinc-800" />
            
            {/* Slot & Format Assignment */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-emerald-500" />
                <h2 className="text-xl font-bold">Scheduling & Format</h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Time Slot <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 pr-10 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 dark:text-zinc-500">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 px-1">Mandatory. Match will immediately drop into this grid block.</p>
                </div>
                
                <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <input 
                      type="checkbox" 
                      id="standardFormat"
                      checked={useStandardFormat}
                      onChange={(e) => setUseStandardFormat(e.target.checked)}
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="standardFormat" className="font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer">
                      Use standard tournament time format
                    </label>
                  </div>
                  
                  {!useStandardFormat && (
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-zinc-800 mt-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">1st Half (mins)</label>
                        <input type="number" value={firstHalf} onChange={e => setFirstHalf(Number(e.target.value))} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">2nd Half (mins)</label>
                        <input type="number" value={secondHalf} onChange={e => setSecondHalf(Number(e.target.value))} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">Half-Time (mins)</label>
                        <input type="number" value={halfTime} onChange={e => setHalfTime(Number(e.target.value))} className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 font-medium" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-zinc-950/50 p-6 md:p-8 border-t border-slate-100 dark:border-zinc-800/80 flex justify-end">
            <Button 
              onClick={handleCreate} 
              disabled={loading} 
              className="w-full md:w-auto px-10 h-14 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 text-lg font-bold rounded-xl transition-all"
            >
              {loading ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : null}
              Confirm & Create Match
            </Button>
          </div>
          
        </div>
      </div>
    </div>
  );
}
