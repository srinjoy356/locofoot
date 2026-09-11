const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lcxgjwdffkexrrnfcuik.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM'
);

async function check() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'user_privacy_settings' }).catch(() => ({}));
  
  // Alternative: query pg_policies
  const { data: policies, error: pgErr } = await supabase.from('pg_policies').select('*').in('tablename', ['users', 'user_privacy_settings']).catch(() => ({}));

  console.log("Policies via pg_policies view (if exposed):", JSON.stringify(policies || pgErr, null, 2));
}

check();
