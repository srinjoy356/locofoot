'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, ShieldAlert, Share2 } from 'lucide-react';
import Link from 'next/link';
import { ShareButton } from '@/components/shared/ShareButton';
import { QRCodeBlock } from '@/components/shared/QRCodeBlock';

import { useMatchClock } from '@/app/(admin)/admin/events/[eventId]/matches/[matchId]/useMatchClock';

export default function PublicMatchPage({ params }: { params: Promise<{ slug: string, matchId: string }> }) {
  const { slug, matchId } = use(params);
  const [matchData, setMatchData] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReferee, setIsReferee] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [refereeEvents, setRefereeEvents] = useState<any[]>([]);
  const [playerMap, setPlayerMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [announcement, setAnnouncement] = useState<any>(null);
  const supabase = createClient();
  
  // We use the event_id from matchData to power the clock, falling back to slug if it's a UUID
  const clockEventId = matchData?.event_id || slug;
  const { elapsed, formatClock } = useMatchClock(clockEventId, matchId);

  useEffect(() => {
    async function loadInitialData() {
      // Fetch match
      const { data: match } = await supabase
        .from('matches')
        .select(`
          id,
          event_id,
          match_state,
          home_score,
          away_score,
          home_registration_id,
          away_registration_id,
          home_team:event_team_registrations!home_registration_id(id, team_name, logo_media_id),
          away_team:event_team_registrations!away_registration_id(id, team_name, logo_media_id)
        `)
        .eq('id', matchId)
        .single();
        
      if (match) setMatchData(match);

      // Fetch timeline
      const { data: timeline } = await supabase
        .from('match_timeline_events')
        .select('*')
        .eq('match_id', matchId)
        .order('elapsed_seconds', { ascending: false });
        
      if (timeline) setTimelineEvents(timeline);

      // Fetch referee
      const { data: referee } = await supabase
        .from('referee_events')
        .select('*')
        .eq('match_id', matchId)
        .order('elapsed_seconds', { ascending: false });
        
      if (referee) setRefereeEvents(referee);

      const { data: { session } } = await supabase.auth.getSession();
      if (session && match) {
        const { data: roles } = await supabase.from('event_roles')
          .select('role')
          .eq('event_id', match.event_id)
          .eq('user_id', session.user.id)
          .in('role', ['EVENT_OWNER', 'EVENT_ADMIN', 'REFEREE']);
          
        if (roles && roles.length > 0) {
          const isOwnerAdmin = roles.some(r => r.role === 'EVENT_OWNER' || r.role === 'EVENT_ADMIN');
          const isRef = roles.some(r => r.role === 'REFEREE');
          
          if (isOwnerAdmin) {
            setIsAdmin(true);
          }
          if (isRef) {
            setIsReferee(true);
          }
        }

        if (match.home_registration_id && match.away_registration_id) {
          const { data: captainStatus } = await supabase.from('event_team_players')
            .select('is_captain_for_event')
            .eq('user_id', session.user.id)
            .in('event_registration_id', [match.home_registration_id, match.away_registration_id])
            .eq('is_captain_for_event', true);
            
          if (captainStatus && captainStatus.length > 0) {
            setIsCaptain(true);
          }

          // Fetch all players for these teams to get their names
          const { data: playersData } = await supabase
            .from('event_team_players')
            .select('id, user_id')
            .in('event_registration_id', [match.home_registration_id, match.away_registration_id]);

          if (playersData && playersData.length > 0) {
            const userIds = playersData.map(p => p.user_id).filter(Boolean);
            if (userIds.length > 0) {
              const { data: usersData } = await supabase
                .from('users')
                .select('id, display_name')
                .in('id', userIds);
                
              const tempMap: Record<string, string> = {};
              playersData.forEach(p => {
                const user = usersData?.find(u => u.id === p.user_id);
                if (user?.display_name) {
                  tempMap[p.id] = user.display_name;
                }
              });
              setPlayerMap(tempMap);
            }
          }
        }
      }
      setIsLoading(false);
    }
    
    loadInitialData();

    const stateChannel = supabase.channel(`match:${matchId}:state`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        setMatchData((prev: any) => ({ 
          ...prev, 
          match_state: payload.new.match_state,
          home_score: payload.new.home_score,
          away_score: payload.new.away_score 
        }));
      })
      .subscribe();

    const timelineChannel = supabase.channel(`match:${matchId}:timeline`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_timeline_events', filter: `match_id=eq.${matchId}` }, (payload) => {
        setTimelineEvents(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_timeline_events', filter: `match_id=eq.${matchId}` }, (payload) => {
        setTimelineEvents(prev => prev.map(ev => ev.id === payload.new.id ? payload.new : ev));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'referee_events', filter: `match_id=eq.${matchId}` }, (payload) => {
        setRefereeEvents(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stateChannel);
      supabase.removeChannel(timelineChannel);
    };
  }, [matchId, supabase]);

  if (isLoading) return <div className="text-center p-12">Loading Match Center...</div>;
  if (!matchData) return <div className="text-center p-12">Match not found.</div>;

  const homeGoals = matchData.home_score || 0;
  const awayGoals = matchData.away_score || 0;
  
  const allEvents = [...timelineEvents, ...refereeEvents]
    .filter(ev => !ev.metadata?.deleted)
    .sort((a, b) => b.elapsed_seconds - a.elapsed_seconds);

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason || !disputeDescription) return;
    
    setIsSubmittingDispute(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/v1/events/${matchData.event_id || slug}/disputes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          target_type: "MATCH",
          match_id: matchId,
          reason: disputeReason,
          description: disputeDescription
        })
      });
      if (res.ok) {
        alert("Dispute submitted successfully. The event organizer will review it.");
        setShowDisputeModal(false);
      } else {
        alert("Failed to submit dispute: " + await res.text());
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Admin Quick Actions */}
      {(isAdmin || isReferee) && (
      <div className="mb-6 flex gap-4 justify-center">
        <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/referee`} className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-bold flex items-center gap-2 text-sm shadow-sm">
          <ShieldAlert className="w-4 h-4" /> Open Referee Dashboard
        </Link>
        {isAdmin && (
          <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/recorder`} className="bg-emerald-50 dark:bg-emerald-950/200 hover:bg-emerald-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 text-sm shadow-sm">
            Open Event Recorder
          </Link>
        )}
      </div>
      )}

      {isAdmin && matchData.match_state === 'SCHEDULED' && (
        <div className="mb-6 flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href={`/events/${matchData.event_id || slug}/matches/${matchId}/lineup?teamId=${matchData.home_registration_id}`}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition"
          >
            Manage Home Lineup
          </Link>
          <Link 
            href={`/events/${matchData.event_id || slug}/matches/${matchId}/lineup?teamId=${matchData.away_registration_id}`}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition"
          >
            Manage Away Lineup
          </Link>
        </div>
      )}

      {(!isAdmin && isCaptain) && matchData.match_state === 'SCHEDULED' && (
        <div className="mb-6 flex justify-center">
          <Link 
            href={`/events/${matchData.event_id || slug}/matches/${matchId}/lineup`}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition"
          >
            Manage Starting Lineup
          </Link>
        </div>
      )}
      
      {/* Scoreboard */}
      <div className="flex justify-end mb-4 print:hidden">
        <ShareButton url={`/events/${clockEventId}/matches/${matchId}`} title="Share Match" />
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
        <div className="text-sm font-bold text-indigo-300 tracking-widest uppercase mb-6 flex items-center justify-center gap-2">
          {matchData.match_state === 'LIVE' && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-50 dark:bg-red-950/200"></span></span>}
          {matchData.match_state.replace('_', ' ')}
        </div>
        
        <div className="flex justify-between items-center px-4 relative z-10">
          <div className="flex flex-col items-center gap-2 w-4/12 text-center">
            <span className="font-bold text-slate-100 line-clamp-2 leading-tight text-lg md:text-2xl">
              {matchData.home_team?.team_name || 'HOME'}
            </span>
          </div>

          <div className="w-4/12 flex justify-center text-5xl md:text-7xl font-mono font-black tracking-tighter drop-shadow-md bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 whitespace-nowrap">
            {homeGoals} - {awayGoals}
          </div>

          <div className="flex flex-col items-center gap-2 w-4/12 text-center">
            <span className="font-bold text-slate-100 line-clamp-2 leading-tight text-lg md:text-2xl">
              {matchData.away_team?.team_name || 'AWAY'}
            </span>
          </div>
        </div>
        
        <div className="mt-8 flex justify-center items-center gap-4">
           <div className="bg-slate-800/80 rounded-xl px-6 py-2 border border-slate-700/50 shadow-inner">
             <div className="text-2xl font-mono font-bold text-slate-200">
               {formatClock()}
             </div>
           </div>
        </div>
      </div>

      {/* Match Statistics Button */}
      <div className="mt-8 flex justify-center gap-4">
        <Link 
          href={`/events/${matchData.event_id || slug}/matches/${matchId}/stats`} 
          className="bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 px-8 py-4 rounded-xl font-black uppercase tracking-widest shadow-lg hover:shadow-xl transition flex items-center gap-3 text-lg"
        >
          <span>📊</span> View Full Match Statistics
        </Link>
      </div>

      {['COMPLETED', 'FULL_TIME', 'ABANDONED'].includes(matchData.match_state) && (isAdmin || isCaptain) && (
        <div className="mt-4 flex justify-center">
          <button 
            onClick={() => setShowDisputeModal(true)}
            className="text-red-500 hover:text-red-600 font-bold flex items-center gap-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
          >
            <ShieldAlert className="w-5 h-5" /> File a Dispute
          </button>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <ShieldAlert className="text-red-500" /> Dispute Match Result
            </h2>
            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Reason</label>
                <select 
                  className="w-full border border-slate-300 dark:border-zinc-700 p-3 rounded-lg dark:bg-zinc-800 dark:text-white"
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="Incorrect Score">Incorrect Score</option>
                  <option value="Missing Event/Goal">Missing Event/Goal</option>
                  <option value="Wrong Goalscorer/Assist">Wrong Goalscorer/Assist</option>
                  <option value="Unregistered Player Fielded">Unregistered Player Fielded</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Details</label>
                <textarea 
                  className="w-full border border-slate-300 dark:border-zinc-700 p-3 rounded-lg dark:bg-zinc-800 dark:text-white"
                  rows={4}
                  placeholder="Provide details and evidence for the dispute..."
                  value={disputeDescription}
                  onChange={e => setDisputeDescription(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowDisputeModal(false)} className="px-4 py-2 text-slate-600 dark:text-zinc-400 font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmittingDispute} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50">
                  {isSubmittingDispute ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timeline Feed */}
      <div className="mt-12 space-y-4">
        <h2 className="font-black text-2xl mb-6 text-slate-800 dark:text-slate-200 flex items-center gap-2">
          Match Timeline
          <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1 ml-4"></div>
        </h2>
        {allEvents.map((ev, i) => {
          const isGoal = ev.metadata?.result === 'GOAL';
          const isCard = ev.event_type === 'YELLOW_CARD' || ev.event_type === 'RED_CARD';
          const isFoul = ev.event_type === 'FOUL';
          const isSub = ev.event_type === 'SUBSTITUTION';
          
          let actorName = (ev.actor_player_id || ev.player_id || ev.event_player_id) ? playerMap[ev.actor_player_id || ev.player_id || ev.event_player_id] : (ev.metadata?.committed_by_player_name || ev.metadata?.player_out_name || null);
          let targetName = ev.target_player_id ? playerMap[ev.target_player_id] : (ev.metadata?.received_by_player_name || ev.metadata?.player_in_name || null);
          
          return (
            <div key={ev.id || i} className={`bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-5 transition hover:shadow-md ${isGoal ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20/30 dark:bg-emerald-900/20' : ''} ${isCard ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30/30 dark:bg-amber-900/20' : ''}`}>
              <div className="font-mono font-black text-slate-400 dark:text-slate-500 w-16 text-lg shrink-0 text-center">
                {ev.display_minute}<span>&apos;</span>
              </div>
              <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide text-sm">{ev.event_type.replace(/_/g, ' ')}</span>
                    {isGoal && <span className="bg-emerald-50 dark:bg-emerald-950/200 text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">GOAL!</span>}
                    {ev.event_type === 'YELLOW_CARD' && <span className="bg-amber-400 w-3 h-4 rounded-sm inline-block shadow-sm"></span>}
                    {ev.event_type === 'RED_CARD' && <span className="bg-red-600 w-3 h-4 rounded-sm inline-block shadow-sm"></span>}
                  </div>
                  
                  {isSub ? (
                    <div className="text-sm font-medium mt-2 flex flex-col gap-1">
                      <div className="flex gap-2 items-center text-red-600 dark:text-red-400">
                        <span className="font-bold uppercase text-[10px] tracking-wider bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">OUT</span> 
                        <span className="dark:text-slate-300">{actorName || 'Unknown Player'}</span>
                      </div>
                      <div className="flex gap-2 items-center text-emerald-600 dark:text-emerald-400">
                        <span className="font-bold uppercase text-[10px] tracking-wider bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">IN</span> 
                        <span className="dark:text-slate-300">{targetName || 'Unknown Player'}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {actorName && (
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 mb-1 flex items-center gap-2 flex-wrap">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">{actorName}</span>
                          {targetName && (
                            <>
                              <span className="text-slate-400 text-xs">&rarr;</span>
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">{targetName}</span>
                            </>
                          )}
                        </div>
                      )}
                      
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {Object.entries(ev.metadata).map(([k, v]) => {
                            if (k === 'result' && v === 'GOAL') return null;
                            if (k.includes('_id') || k.includes('_name')) return null; // hide raw internal keys
                            
                            return (
                              <span key={k} className="capitalize flex gap-1">
                                <span className="text-slate-400 dark:text-slate-500">{k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}:</span> 
                                <span className="text-slate-700 dark:text-slate-300">{String(v).replace(/_/g, ' ')}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
              </div>
            </div>
          );
        })}
        {allEvents.length === 0 && (
          <div className="text-slate-500 dark:text-slate-400 text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 font-medium">Waiting for match events...</div>
        )}
      </div>

      <div className="print:hidden flex justify-center py-8">
        <QRCodeBlock url={`/events/${clockEventId}/matches/${matchId}`} title="Match QR Code" />
      </div>

    </div>
  );
}
