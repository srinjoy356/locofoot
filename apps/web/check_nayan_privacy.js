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
  const { data: user } = await supabase.from('users').select('id, display_name').ilike('display_name', '%nayan%');
  console.log("Found Nayan:", user);
  if (user && user.length > 0) {
    for (const u of user) {
      const { data: priv } = await supabase.from('user_privacy_settings').select('*').eq('user_id', u.id).single();
      console.log(`Privacy for ${u.display_name}:`, priv);
    }
  }
}
run();
