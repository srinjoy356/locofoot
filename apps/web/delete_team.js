require('dotenv').config({ path: 'apps/web/.env' });
const { createClient } = require('@supabase/supabase-js');

// We need the service role key to bypass RLS, because deleting a registration might require admin privileges.
// I'll just use the anon key if RLS allows, or the service role key if it's available in the .env.
// Let's check what's in the env.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('event_team_registrations')
    .select('id, team_name, status')
    .eq('event_id', '1354ff44-0e67-41a1-bdc6-d12f6f4caddf')
    .ilike('team_name', '%MAD TITANS%');

  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Found teams:', data);
  
  // Find the one with 0 players
  for (const team of data) {
    const { count, error: countError } = await supabase
      .from('event_team_players')
      .select('*', { count: 'exact', head: true })
      .eq('event_registration_id', team.id);
      
    console.log(`Team ${team.id} (${team.team_name}) has ${count} players.`);
    
    if (count === 0 && team.status === 'DRAFT') {
      console.log(`Deleting team ${team.id}...`);
      const { error: deleteError } = await supabase
        .from('event_team_registrations')
        .delete()
        .eq('id', team.id);
        
      if (deleteError) {
        console.error('Failed to delete:', deleteError);
      } else {
        console.log('Successfully deleted blank team.');
      }
    }
  }
}

run();
