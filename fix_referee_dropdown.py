import re

file_path = 'apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add tournamentReferees state
state_old = """  const [refereeCodeInputs, setRefereeCodeInputs] = useState<Record<string, string>>({});"""
state_new = """  const [refereeCodeInputs, setRefereeCodeInputs] = useState<Record<string, string>>({});
  const [tournamentReferees, setTournamentReferees] = useState<any[]>([]);"""
content = content.replace(state_old, state_new)

# 2. Add fetching logic inside fetchData
fetch_old = """      setFields(fieldsRes.data || []);
      setEvent(eventRes.data);

      // Load Match Referees manually since match_referees points to auth.users not public.users"""
fetch_new = """      setFields(fieldsRes.data || []);
      setEvent(eventRes.data);

      // Load Tournament Referees
      const { data: tRefs } = await supabase
        .from('event_roles')
        .select('*, user:users!event_roles_user_id_fkey(*)')
        .eq('event_id', eventId)
        .eq('role', 'REFEREE');
      if (tRefs) setTournamentReferees(tRefs);

      // Load Match Referees manually since match_referees points to auth.users not public.users"""
content = content.replace(fetch_old, fetch_new)

# 3. Change handleInviteReferee to accept code directly if passed
handle_old = """  const handleInviteReferee = async (matchId: string) => {
    const code = refereeCodeInputs[matchId];
    if (!code) return;
    setLoading(true);
    const { error } = await supabase.rpc('invite_match_referee', { p_match_id: matchId, p_unique_code: code.trim().toUpperCase() });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      alert('Referee invited! They will receive a notification.');
      setRefereeCodeInputs(prev => ({ ...prev, [matchId]: '' }));
      fetchData();
    }
  };"""
handle_new = """  const handleInviteReferee = async (matchId: string, directCode?: string) => {
    const code = directCode || refereeCodeInputs[matchId];
    if (!code) return;
    setLoading(true);
    const { error } = await supabase.rpc('invite_match_referee', { p_match_id: matchId, p_unique_code: code.trim().toUpperCase() });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      // Don't alert on dropdown change to make it feel seamless
      if (!directCode) alert('Referee invited! They will receive a notification.');
      setRefereeCodeInputs(prev => ({ ...prev, [matchId]: '' }));
      fetchData();
    }
  };"""
content = content.replace(handle_old, handle_new)

# 4. Modify the UI
ui_old = """                                    <span className="text-yellow-600 font-medium italic">No Referee</span>
                                  )}
                                  
                                  <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="FTB-..."
                                      className="border rounded text-xs px-2 py-1 w-24 h-7 uppercase"
                                      value={refereeCodeInputs[assign.matches.id] || ''}
                                      onChange={(e) => setRefereeCodeInputs(prev => ({ ...prev, [assign.matches.id]: e.target.value }))}
                                    />
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleInviteReferee(assign.matches.id)}
                                      disabled={loading || !refereeCodeInputs[assign.matches.id]}
                                      className="h-7 px-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200 text-xs"
                                    >
                                      <UserPlus className="h-3 w-3 mr-1" /> Invite
                                    </Button>
                                  </div>
                                </div>"""
ui_new = """                                    <span className="text-yellow-600 font-medium italic mr-4">No Referee</span>
                                  )}
                                  
                                  <div className="flex gap-2">
                                    <select
                                      className="border border-yellow-200 rounded text-xs px-2 py-1 h-7 bg-yellow-50 text-yellow-800 outline-none"
                                      value={activeRefs.length > 0 && Array.isArray(activeRefs[0].user) ? activeRefs[0].user[0]?.unique_code : (activeRefs.length > 0 ? activeRefs[0].user?.unique_code : '')}
                                      onChange={(e) => {
                                        if (e.target.value) handleInviteReferee(assign.matches.id, e.target.value);
                                      }}
                                    >
                                      <option value="">Assign Referee...</option>
                                      {tournamentReferees.map(tRef => {
                                        const userObj = Array.isArray(tRef.user) ? tRef.user[0] : tRef.user;
                                        if (!userObj) return null;
                                        return (
                                          <option key={tRef.id} value={userObj.unique_code}>
                                            {userObj.display_name} ({userObj.unique_code})
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                </div>"""
content = content.replace(ui_old, ui_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
