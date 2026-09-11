require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const { data, error } = await supabase.from('event_roles').select('*').limit(10);
  console.log('Roles:', data, 'Error:', error);
}
run();
