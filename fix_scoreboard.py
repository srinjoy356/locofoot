s = open('apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx').read()

s = s.replace(
    'home_team:event_team_registrations!home_registration_id(team_name, logo_media_id)',
    'home_team:event_team_registrations!home_registration_id(id, team_name, logo_media_id)'
)

s = s.replace(
    'away_team:event_team_registrations!away_registration_id(team_name, logo_media_id)',
    'away_team:event_team_registrations!away_registration_id(id, team_name, logo_media_id)'
)

old_score = """<div className="w-2/12 flex justify-center text-5xl md:text-7xl font-mono font-black tracking-tighter drop-shadow-md bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
            ? - ?
          </div>"""

new_score = """<div className="w-4/12 flex justify-center text-5xl md:text-7xl font-mono font-black tracking-tighter drop-shadow-md bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 whitespace-nowrap">
            {homeGoals} - {awayGoals}
          </div>"""

s = s.replace(old_score, new_score)
s = s.replace('w-5/12', 'w-4/12')

open('apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx', 'w').write(s)
