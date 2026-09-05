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
    <div className="w-full flex flex-col bg-background text-on-surface h-full min-h-screen">
      {/* Admin Quick Actions */}
      {(isAdmin || isReferee) && (
        <div className="flex gap-4 p-4 border-b border-outline-variant bg-surface-container shrink-0 overflow-x-auto no-scrollbar">
          <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/referee`} className="bg-primary-container text-on-primary-container px-4 py-2 font-label-caps text-label-caps uppercase tracking-widest flex items-center gap-2 shrink-0 hover:bg-primary-fixed transition-colors">
            <span className="material-symbols-outlined text-sm">sports</span> Referee Dashboard
          </Link>
          {isAdmin && (
            <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/recorder`} className="bg-surface-variant text-on-surface border border-outline-variant px-4 py-2 font-label-caps text-label-caps uppercase tracking-widest flex items-center gap-2 shrink-0 hover:bg-surface-container-highest transition-colors">
              Event Recorder
            </Link>
          )}
        </div>
      )}

      {isAdmin && matchData.match_state === 'SCHEDULED' && (
        <div className="flex flex-col sm:flex-row p-4 border-b border-outline-variant gap-4 bg-surface shrink-0">
          <Link 
            href={`/events/${matchData.event_id || slug}/matches/${matchId}/lineup?teamId=${matchData.home_registration_id}`}
            className="flex-1 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest text-center transition"
          >
            Manage Home Lineup
          </Link>
          <Link 
            href={`/events/${matchData.event_id || slug}/matches/${matchId}/lineup?teamId=${matchData.away_registration_id}`}
            className="flex-1 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest text-center transition"
          >
            Manage Away Lineup
          </Link>
        </div>
      )}

      {(!isAdmin && isCaptain) && matchData.match_state === 'SCHEDULED' && (
        <div className="p-4 border-b border-outline-variant bg-surface shrink-0">
          <Link 
            href={`/events/${matchData.event_id || slug}/matches/${matchId}/lineup`}
            className="block w-full border border-primary-container text-primary-container hover:bg-primary-container/10 px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest text-center transition"
          >
            Manage Starting Lineup
          </Link>
        </div>
      )}
      
      {/* Scoreboard */}
      <div className="w-full bg-[#0b0d0c] border-b border-outline-variant relative shrink-0 overflow-hidden min-h-[300px] flex flex-col justify-center py-12 px-margin-mobile md:px-gutter">
        <div className="absolute inset-0 z-0">
          <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-30 " src="/turf/stadium.jpg" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0d0c]/70 via-[#0b0d0c]/40 to-[#0b0d0c]/90 z-10 pointer-events-none"></div>

        <div className="relative z-20 max-w-container-max mx-auto w-full">
          <div className="flex justify-between items-center mb-12">
            <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              {matchData.match_state === 'LIVE' && <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]"></div>}
              {matchData.match_state.replace('_', ' ')}
            </div>
            <div className="print:hidden">
              <ShareButton url={`/events/${clockEventId}/matches/${matchId}`} title="Share Match" />
            </div>
          </div>
          
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-col items-start w-1/3">
              <span className="font-headline-lg-mobile md:text-5xl uppercase tracking-tighter text-on-surface line-clamp-2">
                {matchData.home_team?.team_name || 'HOME'}
              </span>
            </div>

            <div className="w-1/3 flex justify-center items-center">
              <div className="font-mono text-6xl md:text-[120px] font-black tracking-tighter text-on-surface whitespace-nowrap tabular-nums leading-none">
                {homeGoals} <span className="text-outline-variant">-</span> {awayGoals}
              </div>
            </div>

            <div className="flex flex-col items-end w-1/3 text-right">
              <span className="font-headline-lg-mobile md:text-5xl uppercase tracking-tighter text-on-surface line-clamp-2">
                {matchData.away_team?.team_name || 'AWAY'}
              </span>
            </div>
          </div>
          
          <div className="mt-12 flex justify-center items-center">
             <div className="border border-outline-variant bg-surface px-6 py-2">
               <div className="text-4xl font-mono font-bold text-primary-container tabular-nums tracking-tighter">
                 {formatClock()}
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Match Statistics Button */}
      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter mt-8">
        <Link 
          href={`/events/${matchData.event_id || slug}/matches/${matchId}/stats`} 
          className="block w-full border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest text-center transition-colors flex justify-center items-center gap-2"
        >
          <span className="material-symbols-outlined">analytics</span> View Full Match Statistics
        </Link>
      </div>

      {['COMPLETED', 'FULL_TIME', 'ABANDONED'].includes(matchData.match_state) && (isAdmin || isCaptain) && (
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter mt-4">
          <button 
            onClick={() => setShowDisputeModal(true)}
            className="w-full border border-error text-error hover:bg-error/10 px-6 py-4 font-label-caps text-label-caps uppercase tracking-widest flex justify-center items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined">gavel</span> File a Dispute
          </button>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface-container border border-outline-variant p-6 md:p-8 w-full max-w-md shadow-2xl">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface mb-6 flex items-center gap-3 border-b border-outline-variant pb-4">
              <ShieldAlert className="text-error" /> Dispute Result
            </h2>
            <form onSubmit={handleDisputeSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Reason</label>
                <select
                  className="w-full border border-outline-variant p-4 bg-background text-on-surface font-body-md focus:outline-none focus:border-primary-container transition-colors"
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
              <div className="space-y-2">
                <label className="block font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Details</label>
                <textarea
                  className="w-full border border-outline-variant p-4 bg-background text-on-surface font-body-md focus:outline-none focus:border-primary-container transition-colors resize-y"
                  rows={4}
                  placeholder="Provide details and evidence for the dispute..."
                  value={disputeDescription}
                  onChange={e => setDisputeDescription(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowDisputeModal(false)} className="px-6 py-3 text-on-surface-variant font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-variant transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmittingDispute} className="px-6 py-3 bg-error text-on-error font-label-caps text-label-caps uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50">
                  {isSubmittingDispute ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timeline Feed */}
      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter mt-12 pb-12 flex-1">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase text-on-surface mb-6 tracking-tighter">
          Match Timeline
        </h2>
        <div className="flex flex-col gap-0 border-t border-outline-variant">
          {allEvents.map((ev, i) => {
            const isGoal = ev.metadata?.result === 'GOAL';
            const isCard = ev.event_type === 'YELLOW_CARD' || ev.event_type === 'RED_CARD';
            const isFoul = ev.event_type === 'FOUL';
            const isSub = ev.event_type === 'SUBSTITUTION';
            
            let actorName = (ev.actor_player_id || ev.player_id || ev.event_player_id) ? playerMap[ev.actor_player_id || ev.player_id || ev.event_player_id] : (ev.metadata?.committed_by_player_name || ev.metadata?.player_out_name || null);
            let targetName = ev.target_player_id ? playerMap[ev.target_player_id] : (ev.metadata?.received_by_player_name || ev.metadata?.player_in_name || null);
            
            return (
              <div key={ev.id || i} className={`flex items-center border-b border-outline-variant p-4 transition-colors hover:bg-surface ${isGoal ? 'bg-primary-container/5 border-l-4 border-l-primary-container' : 'bg-background'} ${isCard ? (ev.event_type === 'RED_CARD' ? 'border-l-4 border-l-error bg-error/5' : 'border-l-4 border-l-yellow-400 bg-yellow-400/5') : ''}`}>
                <div className="font-mono text-xl tabular-nums tracking-tighter text-on-surface-variant w-12 shrink-0">
                  {ev.display_minute}<span>'</span>
                </div>
                <div className="flex-1 ml-4">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-widest">{ev.event_type.replace(/_/g, ' ')}</span>
                      {isGoal && <span className="bg-primary-container text-on-primary-container text-[9px] font-bold px-2 py-0.5 rounded-none uppercase tracking-widest">GOAL</span>}
                      {ev.event_type === 'YELLOW_CARD' && <span className="bg-yellow-400 w-3 h-4 border border-outline-variant shadow-sm block"></span>}
                      {ev.event_type === 'RED_CARD' && <span className="bg-error w-3 h-4 border border-outline-variant shadow-sm block"></span>}
                    </div>
                    
                    {isSub ? (
                      <div className="text-sm font-medium flex flex-col gap-1 mt-2">
                        <div className="flex gap-2 items-center text-error">
                          <span className="font-mono text-[9px] uppercase tracking-widest border border-error px-1">OUT</span> 
                          <span className="text-on-surface">{actorName || 'Unknown Player'}</span>
                        </div>
                        <div className="flex gap-2 items-center text-primary-fixed-dim">
                          <span className="font-mono text-[9px] uppercase tracking-widest border border-primary-fixed-dim px-1">IN</span> 
                          <span className="text-on-surface">{targetName || 'Unknown Player'}</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {actorName && (
                          <div className="font-body-md text-on-surface mt-1 flex items-center gap-2 flex-wrap">
                            <span className="border border-outline-variant bg-surface px-2 py-1">{actorName}</span>
                            {targetName && (
                              <>
                                <span className="text-on-surface-variant text-xs">&rarr;</span>
                                <span className="border border-outline-variant bg-surface px-2 py-1">{targetName}</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <div className="text-sm text-on-surface-variant font-mono mt-2 flex flex-wrap gap-x-4 gap-y-1 opacity-70">
                            {Object.entries(ev.metadata).map(([k, v]) => {
                              if (k === 'result' && v === 'GOAL') return null;
                              if (k.includes('_id') || k.includes('_name')) return null; 
                              
                              return (
                                <span key={k} className="capitalize flex gap-1">
                                  <span>{k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}:</span> 
                                  <span className="text-on-surface">{String(v).replace(/_/g, ' ')}</span>
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
            <div className="text-on-surface-variant text-center py-12 border-b border-outline-variant bg-surface opacity-50 font-label-caps text-label-caps uppercase tracking-widest">No match events logged yet</div>
          )}
        </div>
      </div>

      <div className="print:hidden flex justify-center py-8">
        <QRCodeBlock url={`/events/${clockEventId}/matches/${matchId}`} title="Match QR Code" />
      </div>

    </div>
  );
}
