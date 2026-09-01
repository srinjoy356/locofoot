import re

s = open('apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx').read()

func_code = """  const handleUnassignFixture = async (fixtureId: string) => {
    try {
      setLoading(true);
      setError('');
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`/api/v1/events/${eventId}/schedule/unassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          fixture_id: fixtureId,
          idempotency_key: crypto.randomUUID()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to unassign fixture');
      }
      
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };"""

new_func = func_code + """

  const handleAssignMeAsReferee = async (fixtureId: string) => {
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

s = s.replace(func_code, new_func)


ui_code = """                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => handleUnassignFixture(assignment.fixture_id)}
                                  className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>"""

new_ui = ui_code + """
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => handleAssignMeAsReferee(assignment.fixture_id)}
                                  className="ml-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
                                >
                                  Assign Me as Referee
                                </Button>"""

s = s.replace(ui_code, new_ui)

open('apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx', 'w').write(s)
