import re

file_path = 'apps/web/src/app/(main)/dashboard/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

state_old = """  const [profileUrl, setProfileUrl] = useState("");"""
state_new = """  const [profileUrl, setProfileUrl] = useState("");
  const [refereeMatches, setRefereeMatches] = useState<any[]>([]);"""
content = content.replace(state_old, state_new)

load_old = """      if (pData) {
        setProfile(pData as unknown as User);
        if (pData.media_assets) {
          setAvatar(pData.media_assets);
        }
      }
    }"""
load_new = """      if (pData) {
        setProfile(pData as unknown as User);
        if (pData.media_assets) {
          setAvatar(pData.media_assets);
        }
      }

      // Load Referee Matches
      const { data: refMatches } = await supabase
        .from("match_referees")
        .select("*, matches!inner(*, events!inner(id, name))")
        .eq("user_id", session.user.id)
        .in("status", ["ACCEPTED", "ASSIGNED"]);
      if (refMatches) setRefereeMatches(refMatches);
    }"""
content = content.replace(load_old, load_new)

ui_old = """      <button 
        onClick={() => {
          supabase.auth.signOut();
          router.push("/login");
        }}
        className="text-red-600 hover:underline"
      >
        Sign Out
      </button>
    </div>
  );
}"""
ui_new = """      {refereeMatches.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-amber-900 mb-4 border-b pb-2">My Referee Assignments</h3>
          <div className="grid gap-4">
            {refereeMatches.map((rm) => (
              <div key={rm.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold">{rm.matches.events.name}</h4>
                  <p className="text-sm text-gray-600">Match ID: {rm.matches.id.substring(0, 8)}... | Status: {rm.matches.match_state}</p>
                </div>
                <button 
                  onClick={() => router.push(`/admin/events/${rm.matches.events.id}/matches/${rm.matches.id}/referee`)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded shadow"
                >
                  Enter Command Center
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button 
        onClick={() => {
          supabase.auth.signOut();
          router.push("/login");
        }}
        className="text-red-600 hover:underline"
      >
        Sign Out
      </button>
    </div>
  );
}"""
content = content.replace(ui_old, ui_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
