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
  const { data: venues, error } = await supabase.from('venues').select('*');
  console.log("All Venues:");
  for (const v of venues || []) {
    console.log(`- ${v.name} (ID: ${v.id})`);
    
    // Delete ones starting with "v" or test ones. Let's see what they are first.
    if (v.name.toLowerCase().startsWith('v') || v.name.toLowerCase().includes('test')) {
      console.log(`  -> Deleting ${v.name}`);
      await supabase.from('venues').delete().eq('id', v.id);
    }
  }
}
run();
