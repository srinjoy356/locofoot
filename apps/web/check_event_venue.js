const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  return match ? match[1] : process.env[key];
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: event, error } = await supabase.from('events').select('id, name, venue_id').eq('id', 'd429c72e-c36e-41f5-a496-809b014be9bf').single();
  console.log("Event:", event);
  if (event?.venue_id) {
    const { data: venue } = await supabase.from('venues').select('*').eq('id', event.venue_id).single();
    console.log("Venue:", venue);
  }
}
run();
