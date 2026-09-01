import re

file_path = 'apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

func_old = """  const handleInviteReferee = async (matchId: string) => {
    const code = refereeCodeInputs[matchId];
    if (!code) return;
    setLoading(true);"""
func_new = """  const handleInviteReferee = async (matchId: string) => {
    const code = refereeCodeInputs[matchId];
    if (!code) return;
    
    const codeUpper = code.trim().toUpperCase();
    const existing = matchReferees[matchId] || [];
    if (existing.find(r => r.user?.unique_code === codeUpper)) {
      alert("This referee is already assigned or pending for this match.");
      return;
    }

    setLoading(true);"""
content = content.replace(func_old, func_new)

with open(file_path, 'w') as f:
    f.write(content)
