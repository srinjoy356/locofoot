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
  
  const testDomains = ['test.com', 'example.com', 'locofoot.local'];
  
  let deletedCount = 0;
  for (const u of users || []) {
    const email = (u.email || '').toLowerCase();
    
    const isTest = testDomains.some(d => email.includes(`@${d}`)) || email.includes('bench.com');
    
    // Also delete duplicate "Nayan Rej" except the most recently updated one?
    // User didn't ask to delete Nayan Rej, but complained about twice. 
    // Wait, the user said "some players are showing twice". Nayan Rej is a real user who just created 3 accounts! 
    // Let's just focus on test accounts first.
                   
    if (isTest) {
      console.log(`Deleting test user: ${u.display_name} (${u.email})`);
      await supabase.from('users').delete().eq('id', u.id);
      deletedCount++;
    }
  }
  
  // Clean up duplicate Nayan Rej accounts? The user Nayan might have created multiple accounts.
  // Maybe I should just increase the limit on the explore page?
  
  console.log(`Deleted ${deletedCount} test accounts.`);
}
run();
