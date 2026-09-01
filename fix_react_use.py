import re
import os

files = [
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx',
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/recorder/page.tsx'
]

for f in files:
    if os.path.exists(f):
        s = open(f).read()
        s = s.replace(
            "export default function RefereePage({ params }: { params: Promise<{ eventId: string, matchId: string }> }) {",
            "export default function RefereePage({ params }: { params: Promise<{ eventId: string, matchId: string }> }) {\n  const { eventId, matchId } = React.use(params);"
        )
        s = s.replace(
            "export default function RecorderPage({ params }: { params: Promise<{ eventId: string, matchId: string }> }) {",
            "export default function RecorderPage({ params }: { params: Promise<{ eventId: string, matchId: string }> }) {\n  const { eventId, matchId } = React.use(params);"
        )
        open(f, 'w').write(s)
