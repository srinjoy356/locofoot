'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Calendar, Trophy, AlertCircle, Clock, Zap, CheckCircle2, XCircle, UserPlus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function SchedulingLivePage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [unassignedFixtures, setUnassignedFixtures] = useState<any[]>([]);
  const [matchReferees, setMatchReferees] = useState<Record<string, any[]>>({});
  const [refereeCodeInputs, setRefereeCodeInputs] = useState<Record<string, string>>({});
  const [tournamentReferees, setTournamentReferees] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  
  useEffect(() => {
    fetchData();

    // Setup Realtime
    const assignmentsSubscription = supabase
      .channel('public:slot_field_assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slot_field_assignments' }, payload => {
        console.log('Assignment change received!', payload);
        fetchData(); // Simplest way to sync in Phase 3
      })
      .subscribe();
      
    const matchesSubscription = supabase
      .channel('public:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, payload => {
        fetchData();
      })
      .subscribe();

    const eventSubscription = supabase
      .channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, payload => {
        setEvent(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(assignmentsSubscription);
      supabase.removeChannel(matchesSubscription);
      supabase.removeChannel(eventSubscription);
    };
  }, [eventId]);

  const fetchData = async () => {
    try {
      const [matchesRes, slotsRes, assignmentsRes, fieldsRes, eventRes] = await Promise.all([
        supabase.from('matches').select('*, home_team:event_team_registrations!home_registration_id(team_name, team_short_name), away_team:event_team_registrations!away_registration_id(team_name, team_short_name)').eq('event_id', eventId).eq('scheduling_status', 'UNASSIGNED'),
        supabase.from('schedule_slots').select('*').eq('event_id', eventId).order('sequence_number', { ascending: true }),
        supabase.from('slot_field_assignments').select('*, schedule_slots!inner(event_id)').eq('schedule_slots.event_id', eventId),
        supabase.from('venue_fields').select('*'), // Should filter by venue_id ideally
        supabase.from('events').select('*').eq('id', eventId).single()
      ]);
      
      setUnassignedFixtures(matchesRes.data || []);
      setSlots(slotsRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setFields(fieldsRes.data || []);
      setEvent(eventRes.data);

      // Load Tournament Referees
      const { data: tRefs } = await supabase
        .from('event_roles')
        .select('*, user:users!event_roles_user_id_fkey(*)')
        .eq('event_id', eventId)
        .eq('role', 'REFEREE');
      if (tRefs) setTournamentReferees(tRefs);

      // Load Match Referees manually since match_referees points to auth.users not public.users
      const { data: allMatches } = await supabase.from('matches').select('id').eq('event_id', eventId);
      if (allMatches && allMatches.length > 0) {
        const matchIds = allMatches.map(m => m.id);
        const { data: mRefs } = await supabase.from('match_referees').select('*').in('match_id', matchIds);
        
        if (mRefs && mRefs.length > 0) {
          const userIds = [...new Set(mRefs.map(mr => mr.user_id))];
          const { data: users } = await supabase.from('users').select('*').in('id', userIds);
          
          const refsMap: Record<string, any[]> = {};
          mRefs.forEach(mr => {
            if (!refsMap[mr.match_id]) refsMap[mr.match_id] = [];
            mr.user = users?.find(u => u.id === mr.user_id);
            refsMap[mr.match_id].push(mr);
          });
          setMatchReferees(refsMap);
        } else {
          setMatchReferees({});
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleInviteReferee = async (matchId: string, directCode?: string) => {
    const code = directCode || refereeCodeInputs[matchId];
    if (!code) return;
    setLoading(true);
    const codeToSend = code === 'CLEAR' ? '' : code.trim().toUpperCase();
    const { error } = await supabase.rpc('invite_match_referee', { p_match_id: matchId, p_unique_code: codeToSend });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      // Don't alert on dropdown change to make it feel seamless
      if (!directCode) alert('Referee invited! They will receive a notification.');
      setRefereeCodeInputs(prev => ({ ...prev, [matchId]: '' }));
      fetchData();
    }
  };

  const handleGenerateFixtures = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const res = await fetch(`/api/v1/events/${eventId}/fixtures/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ idempotency_key: generateUUID() })
      });

      if (!res.ok) {
        let errorMsg = "Failed to generate fixtures";
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          errorMsg = await res.text() || res.statusText;
        }
        throw new Error(errorMsg);
      }

      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNext = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const res = await fetch(`/api/v1/events/${eventId}/schedule/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ idempotency_key: generateUUID() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to generate next slot');
      }
      
      // Realtime will trigger UI update
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignFixture = async (fixtureId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const res = await fetch(`/api/v1/events/${eventId}/schedule/unassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fixture_id: fixtureId })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to unassign fixture');
      }
      
      // Realtime will trigger UI update
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBroadcast = async (newState: 'LIVE' | 'COMPLETED') => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const res = await fetch(`/api/v1/events/${eventId}/broadcast-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ state: newState })
      });

      if (!res.ok) {
        let errorMsg = "Failed to update broadcast state";
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          errorMsg = await res.text() || res.statusText;
        }
        throw new Error(errorMsg);
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-7xl py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent drop-shadow-sm flex items-center gap-3">
            <Zap className="h-8 w-8 text-emerald-500" />
            Live Command Center
          </h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Assign fixtures dynamically into available slots while broadcasting live.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 pr-4 rounded-full shadow-sm border border-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Trophy className="h-5 w-5 text-slate-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unassigned</span>
            <span className="text-lg font-black text-slate-800 leading-none">{unassignedFixtures.length}</span>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-600 shadow-sm">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-bold text-base">Scheduling Blocked</AlertTitle>
          <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 grid-cols-1 xl:grid-cols-3">
        {/* Actions & Stats */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="border-slate-200/60 shadow-lg shadow-emerald-100/50 backdrop-blur-xl bg-white/70 overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
            <CardHeader>
              <CardTitle>Schedule Engine</CardTitle>
              <CardDescription>Populate the next available field slot without violating constraints.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleGenerateNext} 
                disabled={loading || unassignedFixtures.length === 0} 
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all h-14 text-lg font-bold rounded-xl flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Play className="h-6 w-6 fill-current group-hover:scale-110 transition-transform" />
                )}
                Generate Next Fixture
              </Button>
              
              {unassignedFixtures.length === 0 && assignments.length === 0 && (
                <Button 
                  onClick={handleGenerateFixtures} 
                  disabled={loading} 
                  variant="outline"
                  className="w-full mt-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-12 text-md font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                  Generate Fixtures
                </Button>
              )}

              <div className="mt-8 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Broadcasting</h3>
                {event?.scheduling_state !== 'LIVE' ? (
                  <Button 
                    onClick={() => handleToggleBroadcast('LIVE')} 
                    disabled={loading} 
                    className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all h-12 text-md font-bold rounded-xl flex items-center justify-center gap-2 animate-pulse hover:animate-none"
                  >
                    Start Scheduling Broadcast
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleToggleBroadcast('COMPLETED')} 
                    disabled={loading} 
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 h-12 text-md font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    End Scheduling Broadcast
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Grid */}
        <div className="xl:col-span-2">
          <Card className="border-slate-200/60 shadow-lg shadow-slate-100/50 backdrop-blur-xl bg-white/70 overflow-hidden h-full">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-500" />
                Live Assignment Grid
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100/50 text-slate-500 font-semibold sticky top-0">
                    <tr>
                      <th className="px-6 py-4 border-b">Slot</th>
                      <th className="px-6 py-4 border-b">Time</th>
                      <th className="px-6 py-4 border-b">Field</th>
                      <th className="px-6 py-4 border-b">Fixture Assignment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {slots.map((slot) => {
                      const slotAssignments = assignments.filter(a => a.schedule_slot_id === slot.id);
                      return slotAssignments.map((assignment, i) => (
                        <tr key={assignment.id} className="hover:bg-slate-50/50 transition-colors group">
                          {i === 0 && (
                            <>
                              <td rowSpan={slotAssignments.length} className="px-6 py-4 font-black text-slate-800 text-lg align-top bg-white/50">
                                #{slot.sequence_number}
                              </td>
                              <td rowSpan={slotAssignments.length} className="px-6 py-4 text-slate-500 font-medium align-top bg-white/50 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4" />
                                  {new Date(slot.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4 font-medium text-slate-600">
                            {fields.find(f => f.id === assignment.venue_field_id)?.name || 'Unknown Field'}
                          </td>
                          <td className="px-6 py-4">
                            {assignment.fixture_id ? (
                              <div className="flex items-center gap-3">
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Match Assigned ({assignment.fixture_id.substring(0, 8)})
                                </span>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => window.open(`/events/${event?.slug || eventId}/matches/${assignment.fixture_id}`, '_blank')}
                                  className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                >
                                  Open Match Center
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => handleUnassignFixture(assignment.fixture_id)}
                                  className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                                <div className="ml-2 flex items-center gap-2 bg-yellow-50/50 p-1 rounded border border-yellow-100">
                                  {(matchReferees[assignment.fixture_id] || []).length > 0 ? (
                                    <span className="text-xs font-semibold text-yellow-800 mr-2">
                                      Refs: {(matchReferees[assignment.fixture_id] || []).map((r: any) => `${Array.isArray(r.user) ? r.user[0]?.display_name : r.user?.display_name || r.user?.username} (${r.status})`).join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-yellow-600 italic mr-2">No Referee</span>
                                  )}
                                  
                                  <select
                                    className="border border-yellow-200 rounded text-xs px-2 py-1 h-7 bg-white text-yellow-800 outline-none w-32"
                                    value={''}
                                    onChange={(e) => {
                                      if (e.target.value) handleInviteReferee(assignment.fixture_id, e.target.value);
                                    }}
                                  >
                                    <option value="">{ (matchReferees[assignment.fixture_id] || []).length > 0 ? "Change Referee..." : "Assign Referee..."}</option>
                                    {tournamentReferees.map((tRef: any) => {
                                      const userObj = Array.isArray(tRef.user) ? tRef.user[0] : tRef.user;
                                      if (!userObj) return null;
                                      return (
                                        <option key={tRef.id} value={userObj.unique_code}>
                                          {userObj.display_name} ({userObj.unique_code})
                                        </option>
                                      );
                                    })}
                                    { (matchReferees[assignment.fixture_id] || []).length > 0 && <option value="CLEAR">❌ Remove Referee</option> }
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 text-slate-500 font-medium border border-slate-200">
                                Empty
                              </span>
                            )}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
