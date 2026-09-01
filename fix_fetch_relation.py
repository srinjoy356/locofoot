import re

file_path = 'apps/web/src/app/(main)/admin/events/[eventId]/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

func_old = """    // Load referees
    const { data: rData } = await supabase.from('event_roles')
      .select('*, user:users(*)')"""
func_new = """    // Load referees
    const { data: rData } = await supabase.from('event_roles')
      .select('*, user:users!event_roles_user_id_fkey(*)')"""
content = content.replace(func_old, func_new)

with open(file_path, 'w') as f:
    f.write(content)
