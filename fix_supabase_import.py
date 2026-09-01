import re
import glob
import os

files = [
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx',
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/recorder/page.tsx'
]

for f in files:
    if os.path.exists(f):
        s = open(f).read()
        s = s.replace("@/lib/supabaseClient", "@/lib/supabase/client")
        open(f, 'w').write(s)
