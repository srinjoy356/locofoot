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
  const code = 'FTB-KC1AZ9';
  const { data: user, error: uErr } = await supabase.from('users').select('*').eq('unique_code', code).single();
  
  if (!user) {
    console.log("User not found for code:", code);
    return;
  }
  
  console.log(`User: ${user.display_name || user.username} (${user.id})`);
  
  const { data: friends, error: fErr } = await supabase
    .from('friendships')
    .select('*, sender:users!friendships_sender_id_fkey(unique_code, display_name), receiver:users!friendships_receiver_id_fkey(unique_code, display_name)')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    
  if (friends && friends.length > 0) {
    console.log("Friendships found:", friends.length);
    friends.forEach(f => {
      console.log(`- Status: ${f.status}, Sender: ${f.sender.display_name} (${f.sender.unique_code}), Receiver: ${f.receiver.display_name} (${f.receiver.unique_code})`);
    });
  } else {
    console.log("No friendships found for this user.");
  }
}
run();
