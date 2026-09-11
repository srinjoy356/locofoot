const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const anonKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const anonKey = anonKeyMatch ? anonKeyMatch[1].trim() : null;

const client = createClient('https://lcxgjwdffkexrrnfcuik.supabase.co', anonKey, { auth: { persistSession: false } });

async function check() {
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'tp1@example.com',
    password: 'password123'
  });
  
  if (authErr) return console.error("Auth error:", authErr.message);
  
  const { data: playersData, error } = await client
    .from("users")
    .select("id, unique_code, display_name, user_privacy_settings!inner(profile_public)")
    .eq("user_privacy_settings.profile_public", true)
    .not("email", "like", "%@bench.com");
    
  if (error) {
    console.error("Query error:", error.message);
  } else {
    console.log(`Query returned ${playersData.length} users.`);
    console.log("First 15:", playersData.slice(0,15).map(p => p.display_name));
    
    const hasNayan = playersData.some(p => p.display_name && p.display_name.toLowerCase().includes('nayan'));
    console.log(`Is Nayan Rej in the returned list? ${hasNayan}`);
  }
}

check();
