'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Play, Calendar, Trophy, AlertCircle, Clock, Zap, CheckCircle2, XCircle, UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FormatSetupPanel } from '@/components/events/FormatSetupPanel';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/** Drawn knockout games are decided by a shoot-out: the higher score wins and the bracket advances. */
function PensForm({ homeName, awayName, disabled, onSubmit }: { homeName?: string; awayName?: string; disabled: boolean; onSubmit: (home: number, away: number) => void }) {
  const [h, setH] = useState('');
  const [a, setA] = useState('');
  const valid = h !== '' && a !== '' && Number(h) !== Number(a);
  const field = 'w-12 bg-background border border-error text-error px-2 py-1 text-center font-mono text-sm';
  return (
    <span className="inline-flex items-center gap-2 border border-error/60 px-2 py-1">
      <span className="font-label-caps text-[10px] uppercase tracking-widest text-error">DRAW. PENS:</span>
      <input aria-label={`${homeName || 'Home'} penalties`} type="number" min={0} className={field} value={h} onChange={(e) => setH(e.target.value)} />
      <span className="text-error">-</span>
      <input aria-label={`${awayName || 'Away'} penalties`} type="number" min={0} className={field} value={a} onChange={(e) => setA(e.target.value)} />
      <button disabled={!valid || disabled} onClick={() => onSubmit(Number(h), Number(a))} className="bg-error px-3 py-1 font-label-caps text-[10px] uppercase tracking-widest text-on-error disabled:opacity-40">SAVE</button>
    </span>
  );
}

export default function SchedulingLivePage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inline message rather than alert(), which embedded and in-app browsers block.
  const [refereeNotice, setRefereeNotice] = useState<string | null>(null);

  const [unassignedFixtures, setUnassignedFixtures] = useState<any[]>([]);
  const [matchReferees, setMatchReferees] = useState<Record<string, any[]>>({});
  const [refereeCodeInputs, setRefereeCodeInputs] = useState<Record<string, string>>({});
  const [tournamentReferees, setTournamentReferees] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [format, setFormat] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<Record<string, any>>({});
  
  useEffect(() => {
    fetchData();

    // Setup Realtime
    const assignmentsSubscription = supabase
      .channel(`scheduling:assignments:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slot_field_assignments' }, payload => {
        console.log('Assignment change received!', payload);
        fetchData(); // Simplest way to sync in Phase 3
      })
      .subscribe();
      
    const matchesSubscription = supabase
      .channel(`scheduling:matches:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, () => {
        fetchData();
      })
      .subscribe();

    const eventSubscription = supabase
      .channel(`scheduling:event:${eventId}`)
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

      const [teamsCount, matchesCount, settingsRes] = await Promise.all([
        supabase.from('event_team_registrations').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'APPROVED'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('event_settings').select('tournament_format').eq('event_id', eventId).maybeSingle(),
      ]);
      const { data: infoRows } = await supabase
        .from('matches')
        .select('id, match_state, home_score, away_score, metadata, winner_registration_id, home_registration_id, away_registration_id, group:groups(name), bracket:brackets!bracket_id(round_name, position), home_team:event_team_registrations!home_registration_id(team_name), away_team:event_team_registrations!away_registration_id(team_name)')
        .eq('event_id', eventId);
      setMatchInfo(Object.fromEntries((infoRows || []).map((r: any) => [r.id, r])));
      setTeamCount(teamsCount.count || 0);
      setMatchCount(matchesCount.count || 0);
      setFormat(settingsRes.data?.tournament_format ?? null);

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
      setRefereeNotice(error.message);
      fetchData(); // put the dropdown back to what is actually saved
    } else {
      setRefereeNotice(null);
      setRefereeCodeInputs(prev => ({ ...prev, [matchId]: '' }));
      fetchData();
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
        throw new Error(data.detail || 'FAILED TO GENERATE NEXT SLOT');
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
        throw new Error(data.detail || 'FAILED TO UNASSIGN FIXTURE');
      }
      
      // Realtime will trigger UI update
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetWinner = async (matchId: string, winnerId: string, pens?: { home: number; away: number }) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/v1/events/${eventId}/matches/${matchId}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ winner_registration_id: winnerId, shootout_home: pens?.home, shootout_away: pens?.away })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'FAILED TO SET WINNER');
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stageLabel = (info: any) =>
    info?.bracket ? (info.bracket.round_name === 'THIRD_PLACE' ? '3RD PLACE' : `${info.bracket.round_name}${['FINAL', 'THIRD_PLACE'].includes(info.bracket.round_name) ? '' : ' ' + info.bracket.position}`) : (info?.group?.name || 'LEAGUE');

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
        let errorMsg = "FAILED TO UPDATE BROADCAST STATE";
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
    <div className="w-full bg-background min-h-[calc(100vh-64px)] text-on-surface">
      {/* Top Bar */}
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center justify-between">
          <Link href={`/admin/events/${eventId}`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft size={16} />
            <span className="font-label-caps text-label-caps uppercase tracking-widest">EVENT DASHBOARD</span>
          </Link>
          
          <div className="flex items-center gap-2 border border-outline-variant px-3 py-1 bg-background">
            <Trophy size={12} className="text-primary-container" />
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
              UNASSIGNED: <span className="text-on-surface font-bold">{unassignedFixtures.length}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-8">
        <div className="relative overflow-hidden border border-outline-variant bg-[#151816]">
          <div className="absolute inset-0 z-0">
            <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-25 " src="/turf/stadium.jpg" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40 z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          </div>
          <div className="relative z-20 p-6 md:p-8">
            <span className="flex items-center gap-2 mb-3 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]" />
              Live Ops
            </span>
            <h1 className="font-display-lg text-display-lg md:text-[56px] uppercase tracking-tighter leading-none text-on-surface flex items-center gap-4">
              <Zap className="h-10 w-10 text-primary-container hidden md:block" />
              LIVE SCHEDULING
            </h1>
            <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 max-w-xl">
              ASSIGN FIXTURES DYNAMICALLY INTO AVAILABLE SLOTS WHILE BROADCASTING LIVE.
            </p>
          </div>
        </div>

        {error && (
          <div className="border border-error bg-error/10 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-headline-sm uppercase tracking-tighter text-error">SCHEDULING BLOCKED</h3>
              <p className="font-body-sm text-error mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
          {/* Actions & Stats */}
          <div className="xl:col-span-1 space-y-8">
            <FormatSetupPanel
              eventId={eventId}
              teamCount={teamCount}
              matchCount={matchCount}
              capacity={assignments.length}
              initialFormat={format}
              onChanged={fetchData}
            />

            <div className="border border-outline-variant bg-surface p-6">
              <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface mb-2">SCHEDULE ENGINE</h2>
              <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mb-6">
                POPULATE THE NEXT AVAILABLE FIELD SLOT WITHOUT VIOLATING CONSTRAINTS.
              </p>

              <div className="space-y-4">
                <button 
                  onClick={handleGenerateNext} 
                  disabled={loading || unassignedFixtures.length === 0} 
                  className="w-full bg-primary-container text-on-primary-container hover:bg-primary-container/90 py-4 font-headline-sm uppercase tracking-tighter transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                  GENERATE NEXT FIXTURE
                </button>
                
                <button
                  onClick={() => window.open(`/admin/events/${eventId}/matches/create`, '_blank')}
                  className="w-full border border-outline-variant text-on-surface hover:bg-surface-variant py-4 font-label-caps text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  + ADD MANUAL MATCH
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-outline-variant">
                <h3 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mb-4">BROADCASTING</h3>
                {event?.scheduling_state !== 'LIVE' ? (
                  <button 
                    onClick={() => handleToggleBroadcast('LIVE')} 
                    disabled={loading} 
                    className="w-full bg-error text-on-error hover:bg-error/90 py-4 font-headline-sm uppercase tracking-tighter transition-colors flex items-center justify-center gap-2 animate-pulse hover:animate-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    START BROADCAST
                  </button>
                ) : (
                  <button 
                    onClick={() => handleToggleBroadcast('COMPLETED')} 
                    disabled={loading} 
                    className="w-full border border-error text-error hover:bg-error/10 py-4 font-headline-sm uppercase tracking-tighter transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    END BROADCAST
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live Grid */}
          <div className="xl:col-span-3">
            <div className="border border-outline-variant bg-surface">
              <div className="p-6 border-b border-outline-variant bg-surface-container flex items-center gap-3">
                <Calendar className="text-on-surface" size={20} />
                <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">LIVE ASSIGNMENT GRID</h2>
              </div>
              {refereeNotice && (
                <div role="alert" className="m-4 border border-error bg-error/10 p-3 font-body-sm text-error">{refereeNotice}</div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-background border-b border-outline-variant">
                    <tr>
                      <th className="px-6 py-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant border-r border-outline-variant whitespace-nowrap w-24">SLOT</th>
                      <th className="px-6 py-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant border-r border-outline-variant whitespace-nowrap">TIME</th>
                      <th className="px-6 py-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant border-r border-outline-variant whitespace-nowrap">FIELD</th>
                      <th className="px-6 py-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">FIXTURE ASSIGNMENT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {slots.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">NO SLOTS CONFIGURED.</span>
                        </td>
                      </tr>
                    ) : (
                      slots.map((slot) => {
                        const slotAssignments = assignments.filter(a => a.schedule_slot_id === slot.id);
                        if (slotAssignments.length === 0) {
                          return (
                            <tr key={slot.id} className="hover:bg-surface-variant/30 transition-colors">
                              <td className="px-6 py-4 font-headline-sm uppercase tracking-tighter text-on-surface border-r border-outline-variant">#{slot.sequence_number}</td>
                              <td className="px-6 py-4 font-mono text-sm text-on-surface border-r border-outline-variant whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Clock size={14} className="text-on-surface-variant" />
                                  {new Date(slot.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td colSpan={2} className="px-6 py-4 text-center">
                                <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">NO FIELDS ASSIGNED TO THIS SLOT</span>
                              </td>
                            </tr>
                          );
                        }

                        return slotAssignments.map((assignment, i) => (
                          <tr key={assignment.id} className="hover:bg-surface-variant/30 transition-colors">
                            {i === 0 && (
                              <>
                                <td rowSpan={slotAssignments.length} className="px-6 py-4 font-headline-sm uppercase tracking-tighter text-on-surface border-r border-outline-variant bg-surface align-top w-24">
                                  #{slot.sequence_number}
                                </td>
                                <td rowSpan={slotAssignments.length} className="px-6 py-4 font-mono text-sm text-on-surface border-r border-outline-variant bg-surface align-top whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-on-surface-variant" />
                                    {new Date(slot.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </td>
                              </>
                            )}
                            <td className="px-6 py-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface border-r border-outline-variant whitespace-nowrap">
                              {fields.find(f => f.id === assignment.venue_field_id)?.name || 'UNKNOWN FIELD'}
                            </td>
                            <td className="px-6 py-4">
                              {assignment.fixture_id ? (
                                <div className="flex flex-wrap items-center gap-3">
                                  {(() => {
                                    const info = matchInfo[assignment.fixture_id];
                                    return (
                                      <>
                                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary-container/10 text-primary-container border border-primary-container/30 font-label-caps text-[10px] uppercase tracking-widest">
                                          <CheckCircle2 size={12} />
                                          {stageLabel(info)}
                                        </span>
                                        <span className="font-label-caps text-[11px] uppercase tracking-widest text-on-surface">
                                          {info?.home_team?.team_name || 'TBD'} <span className="text-on-surface-variant">vs</span> {info?.away_team?.team_name || 'TBD'}
                                          {info?.match_state === 'COMPLETED' && <span className="ml-2 font-mono text-primary-container">{info.home_score}-{info.away_score}</span>}
                                          {info?.metadata?.shootout && <span className="ml-2 font-mono text-on-surface-variant">(pens {info.metadata.shootout.home}-{info.metadata.shootout.away})</span>}
                                        </span>
                                        {info?.bracket && info.match_state === 'COMPLETED' && info.home_score === info.away_score && !info.winner_registration_id && (
                                          <PensForm
                                            homeName={info.home_team?.team_name}
                                            awayName={info.away_team?.team_name}
                                            disabled={loading}
                                            onSubmit={(h, a2) => handleSetWinner(assignment.fixture_id, h > a2 ? info.home_registration_id : info.away_registration_id, { home: h, away: a2 })}
                                          />
                                        )}
                                      </>
                                    );
                                  })()}
                                  
                                  <button 
                                    onClick={() => window.open(`/events/${event?.slug || eventId}/matches/${assignment.fixture_id}`, '_blank')}
                                    className="border border-outline-variant text-on-surface hover:bg-surface-variant px-3 py-1 font-label-caps text-[10px] uppercase tracking-widest transition-colors"
                                  >
                                    MATCH CENTER
                                  </button>
                                  
                                  <button 
                                    disabled={loading}
                                    onClick={() => handleUnassignFixture(assignment.fixture_id)}
                                    className="text-on-surface-variant hover:text-error transition-colors"
                                    title="UNASSIGN"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                  
                                  <div className="flex items-center gap-2 bg-background border border-outline-variant px-2 py-1 ml-auto">
                                    {(matchReferees[assignment.fixture_id] || []).length > 0 ? (
                                      <span className="font-label-caps text-[10px] uppercase tracking-widest text-primary-container whitespace-nowrap">
                                        REFS: {(matchReferees[assignment.fixture_id] || []).map((r: any) => `${Array.isArray(r.user) ? r.user[0]?.display_name : r.user?.display_name || r.user?.username} (${r.status})`).join(', ')}
                                      </span>
                                    ) : (
                                      <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant italic whitespace-nowrap">NO REFEREE</span>
                                    )}
                                    
                                    <select
                                      className="bg-transparent border-l border-outline-variant pl-2 ml-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface focus:outline-none"
                                      value={''}
                                      onChange={(e) => {
                                        if (e.target.value) handleInviteReferee(assignment.fixture_id, e.target.value);
                                      }}
                                    >
                                      <option value="">{ (matchReferees[assignment.fixture_id] || []).length > 0 ? "CHANGE..." : "ASSIGN..."}</option>
                                      {tournamentReferees.map((tRef: any) => {
                                        const userObj = Array.isArray(tRef.user) ? tRef.user[0] : tRef.user;
                                        if (!userObj) return null;
                                        return (
                                          <option key={tRef.id} value={userObj.unique_code}>
                                            {userObj.display_name} ({userObj.unique_code})
                                          </option>
                                        );
                                      })}
                                      { (matchReferees[assignment.fixture_id] || []).length > 0 && <option value="CLEAR">REMOVE REFEREE</option> }
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 bg-surface-variant border border-outline-variant font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                                  EMPTY
                                </span>
                              )}
                            </td>
                          </tr>
                        ));
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
