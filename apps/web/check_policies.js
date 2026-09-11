const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lcxgjwdffkexrrnfcuik.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM'
);

async function check() {
  const { data: policies, error } = await supabase.rpc('get_policies', { table_name: 'users' }).catch(() => ({}));
  if (error || !policies) {
    const { data: pg, error: pgErr } = await supabase.from('pg_policies').select('*').eq('tablename', 'users');
    console.log("pg_policies:", pg);
  } else {
    console.log("RPC policies:", policies);
  }
}

check();
