import re
import os

files = [
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx',
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/recorder/page.tsx'
]

for f in files:
    if os.path.exists(f):
        s = open(f).read()
        s = re.sub(
            r'(export default function [^{]+\{\n)',
            r'\1  const { eventId, matchId } = React.use(params);\n',
            s
        )
        open(f, 'w').write(s)
