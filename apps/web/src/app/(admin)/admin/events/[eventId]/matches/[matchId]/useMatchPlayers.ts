import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type MatchPlayer = {
  id: string; // event_team_players.id
  user_id: string;
  name: string;
  jersey_number: number | null;
  registration_id: string;
  team: 'home' | 'away';
  participationStatus?: string | null;
};

export function useMatchPlayers(matchId: string) {
  const [players, setPlayers] = useState<{ home: MatchPlayer[], away: MatchPlayer[] }>({ home: [], away: [] });
  const [teams, setTeams] = useState<{ homeName: string, awayName: string }>({ homeName: 'Home', awayName: 'Away' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      const supabase = createClient();
      
      // 1. Get home and away registration IDs
      const { data: match } = await supabase.from('matches').select('home_registration_id, away_registration_id').eq('id', matchId).single();
      
      if (!match) {
        setLoading(false);
        return;
      }

      // 1.5 Fetch team names
      const { data: regs } = await supabase
        .from('event_team_registrations')
        .select('id, team_name')
        .in('id', [match.home_registration_id, match.away_registration_id]);

      if (regs) {
        const hName = regs.find(r => r.id === match.home_registration_id)?.team_name || 'Home';
        const aName = regs.find(r => r.id === match.away_registration_id)?.team_name || 'Away';
        setTeams({ homeName: hName, awayName: aName });
      }

      // 2. Fetch players for both registrations
      const { data: teamPlayers, error: tpError } = await supabase
        .from('event_team_players')
        .select(`
          id,
          user_id,
          jersey_number,
          event_registration_id
        `)
        .in('event_registration_id', [match.home_registration_id, match.away_registration_id])
        .eq('status', 'APPROVED');

      if (tpError) {
        console.error("Error fetching team players:", tpError);
      }

      if (teamPlayers) {
        // 3. Fetch user display names
        const userIds = teamPlayers.map(p => p.user_id);
        const { data: usersData, error: uError } = await supabase
          .from('users')
          .select('id, display_name')
          .in('id', userIds);
          
        if (uError) {
          console.error("Error fetching users:", uError);
        }
        console.log("Fetched users:", usersData);

        const userMap = new Map();
        if (usersData) {
          usersData.forEach(u => userMap.set(u.id, u.display_name));
        }

        const { data: participationData } = await supabase
          .from('match_participation')
          .select('event_player_id, status')
          .eq('match_id', matchId);

        const partMap = new Map();
        if (participationData) {
          participationData.forEach((p: any) => partMap.set(p.event_player_id, p.status));
        }

        const home: MatchPlayer[] = [];
        const away: MatchPlayer[] = [];

        for (const p of teamPlayers) {
          const isHome = p.event_registration_id === match.home_registration_id;
          const player: MatchPlayer = {
            id: p.id,
            user_id: p.user_id,
            name: userMap.get(p.user_id) || 'Unknown Player',
            jersey_number: p.jersey_number,
            registration_id: p.event_registration_id,
            team: isHome ? 'home' : 'away',
            participationStatus: partMap.get(p.id) || null
          };
          if (isHome) home.push(player);
          else away.push(player);
        }

        // Sort by jersey number
        home.sort((a, b) => (a.jersey_number || 99) - (b.jersey_number || 99));
        away.sort((a, b) => (a.jersey_number || 99) - (b.jersey_number || 99));

        setPlayers({ home, away });
      }
      setLoading(false);
    };

    fetchPlayers();

    // Subscribe to match_participation changes
    const supabaseClient = createClient();
    const channel = supabaseClient.channel(`players:participation:${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_participation', filter: `match_id=eq.${matchId}` }, () => {
        fetchPlayers();
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [matchId]);

  return { players, teams, loading };
}
