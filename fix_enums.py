import re
import os

files = [
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx',
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/recorder/page.tsx'
]

for f in files:
    if os.path.exists(f):
        s = open(f).read()
        s = re.sub(r'MatchState\.([A-Z0-9_]+)', r"'\1' as MatchState", s)
        s = re.sub(r'RefereeEventType\.([A-Z0-9_]+)', r"'\1' as RefereeEventType", s)
        s = re.sub(r'MatchPeriod\.([A-Z0-9_]+)', r"'\1' as MatchPeriod", s)
        s = re.sub(r'TimelineEventType\.([A-Z0-9_]+)', r"'\1' as TimelineEventType", s)
        open(f, 'w').write(s)
