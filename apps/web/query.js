const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lcxgjwdffkexrrnfcuik.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM'
);

async function run() {
  // 1. Identify the safe event "box tournament burdwan"
  const { data: allEvents, error: evErr } = await supabase.from('events').select('id, name');
  if (evErr) {
    console.error("Error fetching events", evErr);
    return;
  }
  
  const safeEvent = allEvents.find(e => e.name.toLowerCase().includes('burdwan') || e.name.toLowerCase().includes('box'));
  if (!safeEvent) {
    console.log("CRITICAL: Safe event not found! Aborting stats.");
    console.log("Available events:", allEvents.map(e => e.name));
    return;
  }
  
  console.log(`SAFE EVENT: ${safeEvent.name} (${safeEvent.id})`);
  
  const testEventsToDelete = allEvents.filter(e => e.id !== safeEvent.id);
  console.log(`Events to delete: ${testEventsToDelete.length}`);
  
  // 2. Identify test users (from previous audit, anything with 'test' in name)
  const { data: testUsers } = await supabase
    .from('users')
    .select('id, display_name, email')
    .ilike('display_name', '%test%');
    
  console.log(`Test users to delete: ${testUsers?.length || 0}`);
  
  // What about users associated ONLY with the test events? 
  // Maybe the user wants all players from the test events deleted? "along with all the test players remove those"
  // Let's check event_team_registrations for the events to delete
  const testEventIds = testEventsToDelete.map(e => e.id);
  let teamsToDeleteCount = 0;
  if (testEventIds.length > 0) {
    const { count: teamCount } = await supabase
      .from('event_team_registrations')
      .select('*', { count: 'exact', head: true })
      .in('event_id', testEventIds);
    teamsToDeleteCount = teamCount || 0;
  }
  
  let matchesToDeleteCount = 0;
  if (testEventIds.length > 0) {
    const { count: matchCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .in('event_id', testEventIds);
    matchesToDeleteCount = matchCount || 0;
  }
  
  console.log(`Teams to delete (via events): ${teamsToDeleteCount}`);
  console.log(`Matches to delete (via events): ${matchesToDeleteCount}`);
  
  // Let's check if the user has any data in the safe event
  // We want to make sure we don't delete test users if they somehow participated in the safe event, but they probably didn't.
  
  console.log("Ready to plan cleanup.");
}

run();
