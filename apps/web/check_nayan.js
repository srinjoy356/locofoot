const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lcxgjwdffkexrrnfcuik.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM'
);

async function check() {
  const { data: playersData, error } = await supabase
    .from("users")
    .select("id, unique_code, display_name, avatar_media_id, media_assets(secure_url), user_privacy_settings!inner(profile_public)")
    .eq("user_privacy_settings.profile_public", true)
    .not("email", "like", "%@bench.com")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
  } else {
    console.log(`Explore query returned ${playersData.length} players.`);
    console.log("First 15 players:");
    console.log(playersData.slice(0, 15).map(p => p.display_name));
    
    // Check if Nayan Rej is in the list
    const hasNayan = playersData.some(p => p.display_name && p.display_name.toLowerCase().includes('nayan'));
    console.log(`Is Nayan Rej in the first 100? ${hasNayan}`);
  }
}

check();
