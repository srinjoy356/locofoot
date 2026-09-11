require('dotenv').config({ path: 'apps/web/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('match_player_performance_view')
    .select('player_id, player_name')
    .limit(10);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success, found players:', data);
  }
}
run();
