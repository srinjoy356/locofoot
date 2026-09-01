import re

file_path = 'apps/web/src/app/(main)/admin/events/[eventId]/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Block frontend spamming of the same code
func_old = """  const handleInviteEventReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refereeCode) return;
    try {
      const { error: rpcError } = await supabase.rpc('invite_event_referee', {"""
func_new = """  const handleInviteEventReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refereeCode) return;
    const codeUpper = refereeCode.trim().toUpperCase();
    if (eventReferees.find(r => r.user?.unique_code === codeUpper)) {
      alert("This user is already a referee for this tournament.");
      return;
    }
    try {
      const { error: rpcError } = await supabase.rpc('invite_event_referee', {"""
content = content.replace(func_old, func_new)

with open(file_path, 'w') as f:
    f.write(content)
