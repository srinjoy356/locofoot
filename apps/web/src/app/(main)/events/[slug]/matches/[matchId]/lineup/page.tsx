'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { TurfHero } from '@/components/shared/TurfHero';

export default function LineupPage({ params }: { params: Promise<{ slug: string, matchId: string }> }) {
  const { slug, matchId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTeamId = searchParams.get('teamId');
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);
  const [eventData, setEventData] = useState<any>(null);
  const [teamRegistrationId, setTeamRegistrationId] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>({});
  
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  
  const [lineupStatus, setLineupStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: match } = await supabase
        .from('matches')
        .select(`
          id,
          event_id,
          home_registration_id,
          away_registration_id,
          home:event_team_registrations!home_registration_id(team_name),
          away:event_team_registrations!away_registration_id(team_name)
        `)
        .eq('id', matchId)
        .single();
        
      if (!match) return;
      setMatchData(match);

      const { data: event } = await supabase
        .from('events')
        .select('id, organizer_id')
        .eq('id', match.event_id)
        .single();
        
      const { data: eventSettings } = await supabase
        .from('event_settings')
        .select('players_on_field')
        .eq('event_id', match.event_id)
        .single();
        
      setEventData({ ...event, players_on_field: eventSettings?.players_on_field || 11 });

      const isOrganizer = event?.organizer_id === session.user.id;
      
      const { data: userTeams } = await supabase
        .from('event_team_players')
        .select('event_registration_id, is_captain_for_event')
        .eq('user_id', session.user.id)
        .in('event_registration_id', [match.home_registration_id, match.away_registration_id]);

      let userTeamId = null;
      if (userTeams && userTeams.length > 0) {
        const captainTeam = userTeams.find(t => t.is_captain_for_event);
        userTeamId = captainTeam ? captainTeam.event_registration_id : userTeams[0].event_registration_id;
      } else if (isOrganizer) {
        userTeamId = urlTeamId && [match.home_registration_id, match.away_registration_id].includes(urlTeamId)
          ? urlTeamId 
          : match.home_registration_id;
      }
      
      if (!userTeamId) {
        setDebug({
          sessionUserId: session.user.id,
          eventOrganizerId: event?.organizer_id,
          isOrganizer,
          userTeams,
          eventData: event
        });
        setIsLoading(false);
        return;
      }
      
      setTeamRegistrationId(userTeamId);

      const { data: teamPlayersData } = await supabase
        .from('event_team_players')
        .select(`
          id,
          user_id,
          jersey_number,
          position,
          users ( display_name )
        `)
        .eq('event_registration_id', userTeamId)
        .eq('status', 'APPROVED');
        
      setPlayers(teamPlayersData || []);

      const { data: lineups } = await supabase
        .from('match_lineups')
        .select('id, status')
        .eq('match_id', matchId)
        .eq('team_registration_id', userTeamId)
        .maybeSingle();
        
      if (lineups) {
        setLineupStatus(lineups.status);
        const { data: lineupPlayers } = await supabase
          .from('match_lineup_players')
          .select('event_team_player_id')
          .eq('lineup_id', lineups.id)
          .eq('lineup_role', 'STARTER');
          
        if (lineupPlayers) {
          const ids = new Set(lineupPlayers.map(lp => lp.event_team_player_id));
          setSelectedPlayerIds(ids);
        }
      }

      setIsLoading(false);
    }
    
    loadData();
  }, [matchId, supabase, router, urlTeamId]);

  const togglePlayer = (playerId: string) => {
    if (lineupStatus === 'CONFIRMED') return;
    
    const newSelected = new Set(selectedPlayerIds);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      if (eventData && newSelected.size < eventData.players_on_field) {
        newSelected.add(playerId);
      } else {
        alert(`You can only select up to ${eventData?.players_on_field} starters.`);
      }
    }
    setSelectedPlayerIds(newSelected);
  };

  const submitLineup = async () => {
    if (!eventData || selectedPlayerIds.size !== eventData.players_on_field) return;
    
    setIsSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    const payload = {
      team_registration_id: teamRegistrationId,
      players: Array.from(selectedPlayerIds).map(id => ({
        event_team_player_id: id,
        lineup_role: 'STARTER'
      }))
    };
    
    try {
      const res = await fetch(`/api/v1/events/${eventData.id}/matches/${matchId}/lineups/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setLineupStatus('SUBMITTED');
        alert('Lineup submitted successfully!');
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.detail || 'Failed to submit lineup'}`);
      }
    } catch (e) {
      alert('Network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest animate-pulse">LOADING LINEUP BUILDER...</div>
    </div>
  );

  if (!teamRegistrationId) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="text-center p-6 border border-error bg-error/10">
        <h2 className="font-headline-sm uppercase tracking-tighter text-error mb-2">ACCESS DENIED</h2>
        <p className="font-body-md text-on-surface-variant mb-6">You are not authorized to manage lineups for this match.</p>
        <pre className="text-left p-4 bg-surface-variant text-on-surface-variant font-mono text-[10px] uppercase">
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>
    </div>
  );

  const requiredCount = eventData?.players_on_field || 0;
  const currentCount = selectedPlayerIds.size;
  const isValid = currentCount === requiredCount;
  
  const isHome = matchData.home_registration_id === teamRegistrationId;
  const teamName = isHome ? matchData.home?.team_name : matchData.away?.team_name;

  return (
    <div className="w-full bg-background min-h-screen text-on-surface">
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="font-label-caps text-label-caps uppercase tracking-widest">BACK TO MATCH CENTER</span>
          </button>
          
          {lineupStatus && (
            <div className={`font-label-caps text-[10px] uppercase tracking-widest px-2 py-1 border ${lineupStatus === 'CONFIRMED' ? 'bg-primary-container/20 border-primary-container text-primary-container' : 'bg-surface-variant border-outline-variant text-on-surface-variant'}`}>
              STATUS: {lineupStatus}
            </div>
          )}
        </div>
      </div>

      <TurfHero
        eyebrow="Match Lineup"
        title={teamName ? `${teamName} Lineup` : "Team Lineup"}
        subtitle="Confirm the starting lineup for this match."
        image="/turf/pitch-lines.jpg"
        size="sm"
      />

      <div className="max-w-3xl mx-auto px-margin-mobile md:px-gutter py-12 md:py-16">
        <div className="border border-outline-variant bg-surface relative">
          {/* Header */}
          <div className="p-6 border-b border-outline-variant bg-surface-container flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">SELECT STARTERS</h2>
              <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">
                SELECT EXACTLY {requiredCount} PLAYERS FOR THE STARTING FORMAT.
              </p>
            </div>
            <div className="text-right">
              <span className={`font-display-lg text-[32px] uppercase tracking-tighter ${isValid ? 'text-primary-container' : 'text-on-surface'}`}>
                {currentCount} <span className="text-on-surface-variant text-xl">/ {requiredCount}</span>
              </span>
            </div>
          </div>

          {/* Player List */}
          <div className="divide-y divide-outline-variant">
            {players.map(p => {
              const isSelected = selectedPlayerIds.has(p.id);
              const disabled = lineupStatus === 'CONFIRMED';
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  disabled={disabled}
                  className={`w-full flex items-center justify-between p-4 md:p-6 transition-colors text-left ${isSelected ? 'bg-primary-container/10' : 'bg-surface hover:bg-surface-variant/50'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-6 h-6 border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-primary-container bg-primary-container' : 'border-outline-variant bg-background'}`}>
                      {isSelected && <svg className="w-4 h-4 text-on-primary-container" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div>
                      <div className="font-headline-sm uppercase tracking-tighter text-on-surface">{p.users?.display_name || 'UNKNOWN PLAYER'}</div>
                      <div className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-1 flex gap-3">
                        {p.jersey_number && <span>#{p.jersey_number}</span>}
                        {p.position && <span>{p.position}</span>}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="font-label-caps text-[10px] uppercase tracking-widest text-primary-container border border-primary-container px-2 py-1">
                      STARTER
                    </div>
                  )}
                </button>
              );
            })}
            
            {players.length === 0 && (
              <div className="text-center p-12 bg-background">
                <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                  NO APPROVED PLAYERS FOUND FOR THIS TEAM.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={submitLineup}
            disabled={!isValid || isSubmitting || lineupStatus === 'CONFIRMED'}
            className={`w-full md:w-auto px-10 py-4 font-headline-sm uppercase tracking-tighter transition-colors ${!isValid || lineupStatus === 'CONFIRMED' ? 'bg-surface-variant text-on-surface-variant cursor-not-allowed' : 'bg-primary-container text-on-primary-container hover:bg-primary-container/90'}`}
          >
            {isSubmitting ? 'SUBMITTING...' : (lineupStatus === 'CONFIRMED' ? 'LINEUP LOCKED' : (lineupStatus ? 'UPDATE LINEUP' : 'SUBMIT LINEUP'))}
          </button>
        </div>
      </div>
    </div>
  );
}
