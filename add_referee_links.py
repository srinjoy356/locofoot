import re

s = open('apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx').read()

imports = "import { Clock } from 'lucide-react';"
imports_new = "import { Clock, ShieldAlert } from 'lucide-react';\nimport Link from 'next/link';"
s = s.replace(imports, imports_new)

admin_ui = """      {/* Scoreboard */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">"""

admin_ui_new = """      {/* Admin Quick Actions */}
      <div className="mb-6 flex gap-4 justify-center">
        <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/referee`} className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-bold flex items-center gap-2 text-sm shadow-sm">
          <ShieldAlert className="w-4 h-4" /> Open Referee Dashboard
        </Link>
        <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/recorder`} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 text-sm shadow-sm">
          Open Event Recorder
        </Link>
      </div>
      
      {/* Scoreboard */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">"""

s = s.replace(admin_ui, admin_ui_new)

open('apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx', 'w').write(s)
