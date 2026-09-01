import re

s = open('apps/web/src/app/(main)/admin/events/[eventId]/page.tsx').read()

imports = "import { useState, useEffect } from 'react';"
imports_new = "import { useState, useEffect } from 'react';\nimport { Users, UserPlus } from 'lucide-react';"
s = s.replace(imports, imports_new)

state = "  const [venues, setVenues] = useState<any[]>([]);"
state_new = "  const [venues, setVenues] = useState<any[]>([]);\n  const [refereeCode, setRefereeCode] = useState('');\n  const [eventReferees, setEventReferees] = useState<any[]>([]);"
s = s.replace(state, state_new)

fetch_code = "      const ven = await supabase.from('venues').select('*');"
fetch_new = "      const ven = await supabase.from('venues').select('*');\n      const refs = await supabase.from('event_roles').select('*, user:users(*)').eq('event_id', eventId).eq('role', 'REFEREE');\n      setEventReferees(refs.data || []);"
s = s.replace(fetch_code, fetch_new)

func = """  async function saveSettings(e: React.FormEvent) {"""
func_new = """  const handleInviteEventReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refereeCode) return;
    try {
      const { error: rpcError } = await supabase.rpc('invite_event_referee', {
        p_event_id: eventId,
        p_unique_code: refereeCode.trim().toUpperCase()
      });
      if (rpcError) throw new Error(rpcError.message);
      alert(`Referee Role Granted to ${refereeCode}!`);
      setRefereeCode('');
      loadData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };
  
  async function saveSettings(e: React.FormEvent) {"""
s = s.replace(func, func_new)

ui = """      {/* Phase 3 Schedule Management */}"""
ui_new = """      {/* Referee Management */}
      <div className="bg-amber-50 p-6 border border-amber-200 rounded">
        <h2 className="text-xl font-bold text-amber-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> Referee Roster
        </h2>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <p className="text-sm text-amber-700 mb-2">Grant referee status to users for this tournament. Once granted, they can be assigned to individual matches.</p>
            <form onSubmit={handleInviteEventReferee} className="flex gap-2">
              <input 
                type="text" 
                placeholder="FTB-..." 
                className="border p-2 rounded flex-1 uppercase"
                value={refereeCode}
                onChange={e => setRefereeCode(e.target.value)}
              />
              <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Grant Role
              </button>
            </form>
          </div>
          <div className="flex-1 bg-white rounded border border-amber-100 p-4">
            <h3 className="font-semibold text-sm text-slate-500 mb-3 uppercase tracking-wider">Tournament Referees ({eventReferees.length})</h3>
            {eventReferees.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No referees added yet.</p>
            ) : (
              <ul className="space-y-2">
                {eventReferees.map(r => (
                  <li key={r.id} className="text-sm font-medium flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <span>{r.user?.display_name || r.user?.username} <span className="text-slate-400 text-xs ml-1">({r.user?.unique_code})</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Phase 3 Schedule Management */}"""
s = s.replace(ui, ui_new)
open('apps/web/src/app/(main)/admin/events/[eventId]/page.tsx', 'w').write(s)
