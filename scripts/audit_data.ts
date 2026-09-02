import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'apps/web/.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("--- 4. DATABASE SCORE CONSISTENCY ---");
  
  const { data: matches, error: matchError } = await supabase
    .from('matches')
    .select('id, home_score, away_score, home_registration_id, away_registration_id');
    
  if (matchError) {
    console.error(matchError);
    return;
  }

  const { data: events, error: eventError } = await supabase
    .from('match_timeline_events')
    .select('match_id, actor_registration_id, event_type, metadata')
    .eq('event_type', 'SHOT');

  if (eventError) {
    console.error(eventError);
    return;
  }

  // Filter valid goals
  const goals = events.filter(e => {
    try {
      const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
      return meta && meta.result === 'GOAL' && !meta.deleted;
    } catch (err) {
      return false;
    }
  });

  const results = matches.map(m => {
    const homeGoals = goals.filter(g => g.match_id === m.id && g.actor_registration_id === m.home_registration_id).length;
    const awayGoals = goals.filter(g => g.match_id === m.id && g.actor_registration_id === m.away_registration_id).length;
    
    const isConsistent = homeGoals === (m.home_score || 0) && awayGoals === (m.away_score || 0);
    
    return {
      match_id: m.id,
      derived_home: homeGoals,
      stored_home: m.home_score || 0,
      derived_away: awayGoals,
      stored_away: m.away_score || 0,
      isConsistent
    };
  });

  const consistentCount = results.filter(r => r.isConsistent).length;
  const inconsistentCount = results.length - consistentCount;

  console.log(`Total matches: ${results.length}`);
  console.log(`Consistent: ${consistentCount}`);
  console.log(`Inconsistent: ${inconsistentCount}`);
  console.log(`Consistency %: ${results.length > 0 ? ((consistentCount / results.length) * 100).toFixed(2) : 100}%`);
  
  if (inconsistentCount > 0) {
    console.log("\\nInconsistent Matches:");
    results.filter(r => !r.isConsistent).forEach(r => {
      console.log(`${r.match_id} | Derived: ${r.derived_home}-${r.derived_away} | Stored: ${r.stored_home}-${r.stored_away}`);
    });
  }

  // Other audit checks are schema-based.
}

main().catch(console.error);
