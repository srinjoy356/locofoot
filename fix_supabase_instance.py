import re
import os

files = [
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx',
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/recorder/page.tsx'
]

for f in files:
    if os.path.exists(f):
        s = open(f).read()
        s = s.replace("import { supabase } from '@/lib/supabase/client';", "import { createClient } from '@/lib/supabase/client';\nconst supabase = createClient();")
        open(f, 'w').write(s)
