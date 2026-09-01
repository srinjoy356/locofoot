import re

file_path = 'apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add handleInviteReferee before handleGenerateFixtures
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
      fetchData();
    }
  };

  const handleGenerateFixtures = async () => {"""

content = content.replace("  const handleGenerateFixtures = async () => {", func_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
