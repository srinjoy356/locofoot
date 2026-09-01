import re

file_path = 'apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update Imports
imports_old = """import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  CheckCircle2,"""
imports_new = """import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  CheckCircle2,
  UserPlus,"""
content = content.replace(imports_old, imports_new)

# 2. Add Match Referees state
state_old = """  const [unassignedFixtures, setUnassignedFixtures] = useState<any[]>([]);"""
state_new = """  const [unassignedFixtures, setUnassignedFixtures] = useState<any[]>([]);
  const [matchReferees, setMatchReferees] = useState<Record<string, any[]>>({});
  const [refereeCodeInputs, setRefereeCodeInputs] = useState<Record<string, string>>({});"""
content = content.replace(state_old, state_new)

# 3. Fetch Match Referees in loadData
load_data_old = """      setFields(fRes.data || []);
      setFixtures(fixRes.data || []);"""
load_data_new = """      setFields(fRes.data || []);
      setFixtures(fixRes.data || []);

      const refRes = await supabase.from('match_referees').select('*, user:users(*)');
      const refsByMatch: Record<string, any[]> = {};
      (refRes.data || []).forEach(r => {
        if (!refsByMatch[r.match_id]) refsByMatch[r.match_id] = [];
        refsByMatch[r.match_id].push(r);
      });
      setMatchReferees(refsByMatch);"""
content = content.replace(load_data_old, load_data_new)

# 4. Replace handleAssignMeAsReferee with handleInviteReferee
func_old = """  const handleAssignMeAsReferee = async (matchId: string) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('match_referees').insert({
      match_id: matchId,
      user_id: session?.user.id,
      status: 'ACCEPTED'
    });
    setLoading(false);
    if (error) alert(error.message);
    else alert('You are now the referee for this match');
  };"""
func_new = """  const handleInviteReferee = async (matchId: string) => {
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
      loadData();
    }
  };"""
content = content.replace(func_old, func_new)

# 5. Update UI
ui_old = """                                <Button 
                                  variant="outline"
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => handleAssignMeAsReferee(assignment.fixture_id)}
                                  className="ml-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
                                >
                                  Assign Me as Referee
                                </Button>"""
ui_new = """                                <div className="ml-2 flex items-center gap-2 bg-yellow-50/50 p-1 rounded border border-yellow-100">
                                  {(matchReferees[assignment.fixture_id] || []).length > 0 ? (
                                    <span className="text-xs font-semibold text-yellow-800">
                                      Refs: {(matchReferees[assignment.fixture_id] || []).map((r: any) => `${r.user?.display_name || r.user?.username} (${r.status})`).join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-yellow-600 italic">No Referee</span>
                                  )}
                                  <input 
                                    type="text" 
                                    placeholder="FTB-..." 
                                    className="border rounded px-2 py-1 text-xs w-24 uppercase"
                                    value={refereeCodeInputs[assignment.fixture_id] || ''}
                                    onChange={(e) => setRefereeCodeInputs(prev => ({ ...prev, [assignment.fixture_id]: e.target.value }))}
                                  />
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    disabled={loading}
                                    onClick={() => handleInviteReferee(assignment.fixture_id)}
                                    className="h-7 px-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200 text-xs"
                                  >
                                    <UserPlus className="h-3 w-3 mr-1" /> Invite
                                  </Button>
                                </div>"""
content = content.replace(ui_old, ui_new)

with open(file_path, 'w') as f:
    f.write(content)
