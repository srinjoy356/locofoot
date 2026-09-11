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
  const eventId = 'd429c72e-c36e-41f5-a496-809b014be9bf';
  const venueId = '5f8be561-fba6-4b96-910a-ff70ad52a0d9';

  // 1. Add a field if there isn't one
  const { data: fields } = await supabase.from('venue_fields').select('*').eq('venue_id', venueId);
  if (!fields || fields.length === 0) {
    console.log("No fields found. Adding 'Pitch 1'...");
    await supabase.from('venue_fields').insert({
      venue_id: venueId,
      name: 'Pitch 1'
    });
  } else {
    console.log("Fields already exist:", fields);
  }

  // 2. Reset event scheduling state to NOT_STARTED
  console.log("Resetting event state...");
  await supabase.from('events').update({
    scheduling_state: 'NOT_STARTED',
    slot_structure_state: 'DRAFT'
  }).eq('id', eventId);

  // 3. Delete existing generated slots so they can start fresh
  console.log("Deleting empty slots...");
  await supabase.from('schedule_slots').delete().eq('event_id', eventId);

  console.log("Done!");
}
run();
