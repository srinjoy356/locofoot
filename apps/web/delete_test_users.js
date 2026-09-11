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
  const { data: users } = await supabase.from('users').select('id, display_name, email');
  
  const keywords = ['recorder', 'organiser', 'audit', 'test', 'admin', 'bot'];
  
  for (const u of users || []) {
    const name = (u.display_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    
    const isTest = keywords.some(k => name.includes(k)) || 
                   email.includes('bench.com') ||
                   name === 'v'; // earlier test venues were v
                   
    if (isTest) {
      console.log(`Deleting test user: ${u.display_name} (${u.email})`);
      await supabase.from('users').delete().eq('id', u.id);
    }
  }
  console.log("Cleanup complete.");
}
run();
