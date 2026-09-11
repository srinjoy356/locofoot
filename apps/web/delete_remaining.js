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
  const { data: users, error } = await supabase.from('users').select('*');
  
  let deletedCount = 0;
  for (const u of users || []) {
    const name = (u.display_name || '').toLowerCase();
    
    // Check for E2E and dummy prefixes
    if (name.includes('test_') || 
        name.includes('ref_') || 
        name.includes('org_') || 
        name.includes('viewer_') || 
        name.includes('player_') ||
        name.includes('referee') ||
        name.includes('organizer') ||
        name === 'v') {
      console.log(`Deleting remaining test user: ${u.display_name} (${u.email})`);
      await supabase.from('users').delete().eq('id', u.id);
      deletedCount++;
    }
  }
  
  console.log(`Deleted ${deletedCount} bad named accounts.`);
}
run();
