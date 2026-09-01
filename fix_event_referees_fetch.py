import re

file_path = 'apps/web/src/app/(main)/admin/events/[eventId]/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Add fetch for eventReferees
func_old = """    // Load venues
    const { data: vData } = await supabase.from('venues').select('*');
    if (vData) setVenues(vData);
  }"""
func_new = """    // Load venues
    const { data: vData } = await supabase.from('venues').select('*');
    if (vData) setVenues(vData);

    // Load referees
    const { data: rData } = await supabase.from('event_roles')
      .select('*, user:users(*)')
      .eq('event_id', eventId)
      .eq('role', 'REFEREE');
    if (rData) setEventReferees(rData);
  }"""
content = content.replace(func_old, func_new)

with open(file_path, 'w') as f:
    f.write(content)
