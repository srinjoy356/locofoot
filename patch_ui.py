import re

s = open('apps/web/src/app/(main)/events/[slug]/page.tsx').read()

fetch_logic = """
      if (ev) {
        // Fetch matches
        const { data: matchData } = await supabase
          .from('matches')
          .select(`
            id,
            match_state,
            home_team:event_team_registrations!home_registration_id(team_name),
            away_team:event_team_registrations!away_registration_id(team_name)
          `)
          .eq('event_id', ev.id);
        if (matchData) setMatches(matchData);
"""

s = s.replace('if (ev) {', fetch_logic, 1)

ui_logic = """
      <div className="flex flex-col gap-4 bg-white p-4 border rounded mt-8">
        <h2 className="text-xl font-bold">Matches</h2>
        {matches.length > 0 ? (
          <ul className="space-y-2">
            {matches.map((m: any) => (
              <li key={m.id} className="flex justify-between items-center border p-3 rounded hover:bg-gray-50 transition">
                <div>
                  <div className="font-bold">
                    {m.home_team?.team_name || 'TBD'} vs {m.away_team?.team_name || 'TBD'}
                  </div>
                  <div className="text-xs text-gray-500 font-semibold">
                    State: {m.match_state}
                  </div>
                </div>
                <Link 
                  href={`/events/${event.slug || event.id}/matches/${m.id}`}
                  className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700"
                >
                  View Match Center
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">No matches found for this event yet.</p>
        )}
      </div>

      <div className="mt-8">
"""

s = s.replace('<div className="mt-8">', ui_logic, 1)

open('apps/web/src/app/(main)/events/[slug]/page.tsx', 'w').write(s)
