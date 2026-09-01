import re

file_path = 'apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

role_old = """      if (session && match) {
        const { data: roleData } = await supabase.from('event_roles')
          .select('role')
          .eq('event_id', match.event_id)
          .eq('user_id', session.user.id)
          .in('role', ['EVENT_OWNER', 'EVENT_ADMIN', 'REFEREE'])
          .maybeSingle();
        if (roleData) {
          if (roleData.role === 'REFEREE') {
            setIsReferee(true);
          } else {
            setIsAdmin(true);
          }
        }
      }"""
role_new = """      if (session && match) {
        const { data: roles } = await supabase.from('event_roles')
          .select('role')
          .eq('event_id', match.event_id)
          .eq('user_id', session.user.id)
          .in('role', ['EVENT_OWNER', 'EVENT_ADMIN', 'REFEREE']);
          
        if (roles && roles.length > 0) {
          const isOwnerAdmin = roles.some(r => r.role === 'EVENT_OWNER' || r.role === 'EVENT_ADMIN');
          const isRef = roles.some(r => r.role === 'REFEREE');
          
          if (isOwnerAdmin) {
            setIsAdmin(true);
          }
          if (isRef) {
            setIsReferee(true);
          }
        }
      }"""
content = content.replace(role_old, role_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
