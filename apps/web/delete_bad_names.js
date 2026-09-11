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
  
  const testNames = [
    'United Sub', 'United Midfielder', 'United Defender', 'United Goalkeeper', 'United Attacker',
    'City Sub', 'City Midfielder', 'City Defender', 'City Goalkeeper', 'City Attacker',
    'Amit Sharma', 'Rahul Das', 'Suresh Roy', 'Sunil Chhetri', 'Bhaichung Bhutia', 'Anirudh Thapa', 
    'Gurpreet Singh', 'Sandesh Jhingan', 'Jeje Lalpekhlua', 'V'
  ];
  
  let deletedCount = 0;
  for (const u of users || []) {
    const name = u.display_name || '';
    
    // Strict exact match for known test names
    const isBadName = testNames.includes(name);
                   
    if (isBadName) {
      console.log(`Deleting exact match test user: ${u.display_name} (${u.email})`);
      await supabase.from('users').delete().eq('id', u.id);
      deletedCount++;
    } else if (name.toLowerCase().includes('sub ') || name.toLowerCase().includes('goalkeeper') || name.toLowerCase().includes('defender') || name.toLowerCase().includes('attacker') || name.toLowerCase().includes('midfielder')) {
      console.log(`Deleting partial match test user: ${u.display_name} (${u.email})`);
      await supabase.from('users').delete().eq('id', u.id);
      deletedCount++;
    }
  }
  
  console.log(`Deleted ${deletedCount} bad named accounts.`);
}
run();
