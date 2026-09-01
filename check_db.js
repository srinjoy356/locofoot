const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('apps/api/.env', 'utf8');
let url, key;
for (const line of env.split('\n')) {
    if (line.startsWith('SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function main() {
    const { data: users } = await supabase.from('users').select('*').ilike('display_name', '%nayan%');
    console.log("Users:", users);
    
    if (!users || users.length === 0) return;
    const nayan_id = users[0].id;
    
    const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', nayan_id).order('created_at', { ascending: false });
    console.log("Notifs:", notifs);
    
    const { data: invs } = await supabase.from('event_team_invitations').select('*').eq('invited_user_id', nayan_id).order('created_at', { ascending: false });
    console.log("Invitations:", invs);
}

main();
