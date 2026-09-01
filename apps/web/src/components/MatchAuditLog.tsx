'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function MatchAuditLog({ matchId, eventId, eventType }: { matchId: string, eventId: string, eventType: 'timeline' | 'referee' }) {
  const [logs, setLogs] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchLogs = async () => {
      const table = eventType === 'timeline' ? 'match_timeline_events' : 'referee_events';
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data) setLogs(data);
    };

    fetchLogs();

    const channel = supabase.channel(`audit:${matchId}:${eventType}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: eventType === 'timeline' ? 'match_timeline_events' : 'referee_events', filter: `match_id=eq.${matchId}` }, (payload) => {
        fetchLogs();
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [matchId, eventType]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event? This will be logged as a correction.")) return;

    // We submit a correction request to the API with an empty payload or a specific 'DELETED' flag.
    // For now, we will mark it as deleted in metadata.
    const log = logs.find(l => l.id === id);
    if (!log) return;

    // Make sure we only send the metadata block, not the entire row.
    // We strip out 'result' (e.g. 'GOAL') so the atomic Postgres trigger automatically decrements the match score.
    const { result, ...restMetadata } = log.metadata || {};
    
    await fetch(`/api/v1/events/${eventId}/matches/${matchId}/${eventType}/event`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (c === 'x' ? Math.random() * 16 | 0 : (Math.random() * 16 | 0 & 0x3 | 0x8)).toString(16)),
        timeline_event_id: id,
        corrected_payload: { ...restMetadata, deleted: true },
        reason: "User deleted event via UI"
      })
    });
  };

  return (
    <div className="mt-8 border-t border-slate-200 pt-4">
      <h3 className="font-bold text-slate-700 mb-4">Recent Audit Log</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {logs.map(log => (
          <div key={log.id} className={`p-3 rounded text-sm flex justify-between items-center ${log.metadata?.deleted ? 'bg-red-50 text-red-500 line-through' : 'bg-white border border-slate-200'}`}>
            <div>
              <span className="font-mono text-slate-500 mr-2">{log.display_minute}':{log.display_second.toString().padStart(2, '0')}</span>
              <span className="font-bold">{log.event_type}</span>
              {log.event_type === 'SUBSTITUTION' && log.metadata?.player_in_name && log.metadata?.player_out_name && (
                <span className="ml-2 text-slate-600 text-xs">({log.metadata.player_out_name} &rarr; {log.metadata.player_in_name})</span>
              )}
            </div>
            {!log.metadata?.deleted && (
              <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-700 font-bold ml-2 text-xs">Undo</button>
            )}
          </div>
        ))}
        {logs.length === 0 && <p className="text-sm text-slate-500 text-center">No events recorded yet.</p>}
      </div>
    </div>
  );
}
