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
  const { data: playersData, error } = await supabase
    .from("users")
    .select("id, unique_code, display_name, avatar_media_id, media_assets(secure_url), user_privacy_settings!inner(profile_public)")
    .eq("user_privacy_settings.profile_public", true)
    .not("email", "like", "%@bench.com")
    .order("created_at", { ascending: false })
    .limit(100);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Returned ${playersData.length} players`);
  
  // Group by display_name to find duplicates
  const names = {};
  playersData.forEach(p => {
    names[p.display_name] = (names[p.display_name] || 0) + 1;
  });
  
  Object.keys(names).forEach(n => {
    if (names[n] > 1) {
      console.log(`Duplicate: ${n} (${names[n]} times)`);
    }
  });
  
  // Is Nayan Rej in there?
  const nayan = playersData.filter(p => p.display_name?.toLowerCase().includes('nayan'));
  console.log("Nayan in query result:", nayan.length, nayan);
}
run();
