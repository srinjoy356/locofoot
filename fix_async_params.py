import re
import os

files = [
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx',
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/recorder/page.tsx'
]

for f in files:
    if os.path.exists(f):
        s = open(f).read()
        
        # Add React import if not there
        if 'import React' not in s and 'from "react"' not in s and "from 'react'" not in s:
            s = "import React from 'react';\n" + s
        elif 'import { useState, useEffect } from' in s:
            s = s.replace('import { useState, useEffect }', 'import React, { useState, useEffect }')
        
        # Fix params definition
        s = re.sub(r'export default function [a-zA-Z]+\({ params }: { params: { [^}]+ } }\) {',
                   lambda m: m.group(0).replace(' { params: ', ' { params: Promise<') + '> } {', s)
                   
        # Unwrap params
        if 'const { eventId, matchId } = React.use(params);' not in s:
            s = re.sub(r'(export default function [^{]+\{\n)', r'\1  const { eventId, matchId } = React.use(params);\n', s)
            
        # Replace params.eventId and params.matchId with just eventId and matchId
        s = s.replace('params.eventId', 'eventId')
        s = s.replace('params.matchId', 'matchId')
        
        open(f, 'w').write(s)
