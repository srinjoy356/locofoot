const { createClient } = require('@supabase/supabase-js');

const url = "https://lcxgjwdffkexrrnfcuik.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NDAxMDAsImV4cCI6MjEwMzExNjEwMH0.YTj_IxFeEJ86ee6jOJHOhYPshtRA4xOSVYAtoQPoF2M";

const supabase = createClient(url, key);

console.log("Subscribing to realtime...");
const channel = supabase
  .channel('test_channel')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_announcements' }, payload => {
    console.log("REALTIME UPDATE RECEIVED:", payload);
  })
  .subscribe((status) => {
    console.log("STATUS:", status);
  });

setTimeout(async () => {
    console.log("Triggering broadcast via API...");
    // Using service role key to insert
    const srvKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM";
    const admin = createClient(url, srvKey);
    
    // We need an event_id and author_id. Let's fetch one event.
    const { data: evs } = await admin.from('events').select('id, created_by').limit(1);
    if (!evs || evs.length === 0) {
        console.log("No events found.");
        return;
    }
    
    const eventId = evs[0].id;
    const authorId = evs[0].created_by;
    
    const { error } = await admin.from('event_announcements').insert({
        event_id: eventId,
        author_id: authorId,
        message: "Test announcement via script",
        is_emergency: true
    });
    
    if (error) {
        console.error("Insert error:", error);
    } else {
        console.log("Insert successful.");
    }
}, 3000);

setTimeout(() => {
    console.log("Done waiting.");
    process.exit(0);
}, 10000);
