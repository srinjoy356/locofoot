import re

file_path = 'apps/web/src/app/(main)/dashboard/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

load_old = """      // Load Referee Matches
      const { data: refMatches } = await supabase
        .from("match_referees")
        .select("*, matches!inner(*, events!inner(id, name))")
        .eq("user_id", session.user.id)
        .in("status", ["ACCEPTED", "ASSIGNED"]);
      if (refMatches) setRefereeMatches(refMatches);"""
load_new = """      // Load Referee Matches
      // 1. Matches they were explicitly assigned to
      const { data: explicitMatches } = await supabase
        .from("match_referees")
        .select("*, matches!inner(*, events!inner(id, name))")
        .eq("user_id", session.user.id)
        .in("status", ["ACCEPTED", "ASSIGNED"]);
        
      // 2. All matches in events where they are a Tournament Referee
      const { data: eventRoles } = await supabase
        .from("event_roles")
        .select("event_id")
        .eq("user_id", session.user.id)
        .eq("role", "REFEREE");
        
      let tournamentMatches: any[] = [];
      if (eventRoles && eventRoles.length > 0) {
        const eventIds = eventRoles.map(r => r.event_id);
        const { data: tMatches } = await supabase
          .from("matches")
          .select("*, events!inner(id, name)")
          .in("event_id", eventIds);
          
        if (tMatches) {
          tournamentMatches = tMatches.map(m => ({
            id: `tournament-ref-${m.id}`,
            matches: m
          }));
        }
      }
      
      const allMatches = [...(explicitMatches || []), ...tournamentMatches];
      // Deduplicate by match id
      const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.matches.id, item])).values());
      setRefereeMatches(uniqueMatches);"""
content = content.replace(load_old, load_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
