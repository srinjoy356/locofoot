import re

s = open('apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx').read()

imports = "import { Calendar, CheckCircle2, Clock, Loader2, Play, AlertCircle, XCircle, Zap } from 'lucide-react';"
imports_new = "import { Calendar, CheckCircle2, Clock, Loader2, Play, AlertCircle, XCircle, Zap, UserPlus } from 'lucide-react';\nimport { Input } from '@/components/ui/input';"
s = s.replace(imports, imports_new)

func = """  const handleAssignMeAsReferee = async (fixtureId: string) => {
    try {
      setLoading(true);
      setError('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      
      const { error: dbError } = await supabase.from('match_referees').insert({
        match_id: fixtureId,
        user_id: session.user.id,
        status: 'ACCEPTED',
        assigned_by: session.user.id
      });
      
      if (dbError) throw new Error(dbError.message);
      
      alert("You have been assigned as the referee for this match!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };"""

func_new = """  const [refereeCode, setRefereeCode] = useState<Record<string, string>>({});
  const handleInviteReferee = async (fixtureId: string) => {
    try {
      const code = refereeCode[fixtureId];
      if (!code) {
        alert("Please enter a valid FTB- code");
        return;
      }
      setLoading(true);
      setError('');
      
      const { error: rpcError } = await supabase.rpc('invite_match_referee', {
        p_match_id: fixtureId,
        p_unique_code: code.trim()
      });
      
      if (rpcError) throw new Error(rpcError.message);
      
      alert(`Invitation sent to ${code}!`);
      setRefereeCode(prev => ({ ...prev, [fixtureId]: '' }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };"""

s = s.replace(func, func_new)

ui = """                                <Button 
                                  variant="outline"
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => handleAssignMeAsReferee(assignment.fixture_id)}
                                  className="ml-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
                                >
                                  Assign Me as Referee
                                </Button>"""

ui_new = """                                <div className="flex items-center gap-2 ml-4">
                                  <Input 
                                    placeholder="Ref Code (FTB-...)" 
                                    className="w-32 h-8 text-xs"
                                    value={refereeCode[assignment.fixture_id] || ''}
                                    onChange={(e) => setRefereeCode(prev => ({ ...prev, [assignment.fixture_id]: e.target.value.toUpperCase() }))}
                                  />
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    disabled={loading}
                                    onClick={() => handleInviteReferee(assignment.fixture_id)}
                                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                                  >
                                    <UserPlus className="w-4 h-4 mr-1" />
                                    Invite
                                  </Button>
                                </div>"""

s = s.replace(ui, ui_new)
open('apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx', 'w').write(s)
