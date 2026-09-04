'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileWarning, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default function DisputesDashboardPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: dData } = await supabase
        .from('disputes')
        .select(`
          id, target_type, target_id, reason, description, status, created_at,
          reporter_id, match_id,
          matches(match_state, home_team:event_team_registrations!home_registration_id(team_name), away_team:event_team_registrations!away_registration_id(team_name))
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (dData) setDisputes(dData);

      const { data: rData } = await supabase
        .from('reports')
        .select(`
          id, target_type, target_id, reason, description, status, created_at
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (rData) setReports(rData);
    }
    loadData();
  }, [eventId, supabase]);

  const updateDisputeStatus = async (disputeId: string, status: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/v1/events/${eventId}/disputes/${disputeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status })
    });
    
    if (res.ok) {
      alert(`Dispute updated to ${status}`);
      setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status } : d));
    } else {
      alert(`Error updating dispute`);
    }
  };

  const updateReportStatus = async (reportId: string, status: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/v1/events/${eventId}/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status })
    });
    
    if (res.ok) {
      alert(`Report updated to ${status}`);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    } else {
      alert(`Error updating report`);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold dark:text-zinc-100 flex items-center gap-2">
          <FileWarning className="text-purple-500" /> Disputes & Reports
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">Review and resolve official disputes and referee/player reports.</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold dark:text-zinc-100 border-b dark:border-zinc-800 pb-2">Active Disputes</h2>
        {disputes.length === 0 ? (
          <p className="text-gray-500 dark:text-zinc-500 italic text-sm">No disputes filed for this event.</p>
        ) : (
          <div className="grid gap-4">
            {disputes.map(dispute => (
              <div key={dispute.id} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      dispute.status === 'OPEN' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      dispute.status === 'UNDER_REVIEW' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {dispute.status}
                    </span>
                    <span className="text-sm font-semibold dark:text-zinc-300 uppercase tracking-wider">{dispute.target_type} DISPUTE</span>
                    <span className="text-xs text-gray-400">{new Date(dispute.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h3 className="font-bold text-lg dark:text-zinc-100">{dispute.reason}</h3>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">{dispute.description}</p>
                  
                  {dispute.target_type === 'MATCH' && dispute.match_id && (
                    <div className="mt-3 text-sm bg-gray-50 dark:bg-zinc-800 p-2 rounded">
                      <span className="font-semibold text-gray-700 dark:text-zinc-300">Match in Question:</span> 
                      {' '}{dispute.matches?.home_team?.team_name || 'TBD'} vs {dispute.matches?.away_team?.team_name || 'TBD'}
                      <div className="mt-2 flex gap-4">
                        <Link href={`/admin/events/${eventId}/matches/${dispute.match_id}/recorder`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                          Open Match Recorder &rarr;
                        </Link>
                        {dispute.status === 'APPROVED' && dispute.matches?.match_state !== 'PAUSED' && (
                          <button 
                            onClick={async () => {
                              if (!confirm("Are you sure you want to reopen this match? This will change the match state to PAUSED, allowing the recorder to be used again.")) return;
                              const { data: { session } } = await supabase.auth.getSession();
                              const res = await fetch(`/api/v1/events/${eventId}/matches/${dispute.match_id}/referee/state`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                                body: JSON.stringify({ idempotency_key: crypto.randomUUID(), new_state: 'PAUSED' })
                              });
                              if (res.ok) {
                                alert("Match reopened successfully! You can now edit events in the recorder.");
                                setDisputes(prev => prev.map(d => d.id === dispute.id ? { ...d, matches: { ...d.matches, match_state: 'PAUSED' } } : d));
                              }
                              else alert("Failed to reopen match.");
                            }} 
                            className="text-amber-600 dark:text-amber-500 hover:underline font-medium"
                          >
                            Reopen Match &rarr;
                          </button>
                        )}
                        {dispute.status === 'APPROVED' && dispute.matches?.match_state === 'PAUSED' && (
                          <button 
                            onClick={async () => {
                              if (!confirm("Are you sure you want to finalize this match and close the dispute?")) return;
                              const { data: { session } } = await supabase.auth.getSession();
                              
                              // First update match to COMPLETED
                              const matchRes = await fetch(`/api/v1/events/${eventId}/matches/${dispute.match_id}/referee/state`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                                body: JSON.stringify({ idempotency_key: crypto.randomUUID(), new_state: 'COMPLETED' })
                              });
                              
                              if (matchRes.ok) {
                                // Then close dispute as MODIFIED
                                await updateDisputeStatus(dispute.id, 'MODIFIED');
                                alert("Match finalized and dispute closed successfully!");
                              } else {
                                alert("Failed to finalize match.");
                              }
                            }} 
                            className="text-green-600 dark:text-green-500 hover:underline font-medium flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" /> Finalize Match & Close Dispute
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex md:flex-col gap-2 w-full md:w-auto">
                  {dispute.status === 'OPEN' && (
                    <button onClick={() => updateDisputeStatus(dispute.id, 'UNDER_REVIEW')} className="flex-1 bg-amber-600 text-white px-3 py-1.5 text-sm rounded shadow-sm hover:bg-amber-700 flex justify-center items-center gap-1">
                      <Clock className="w-4 h-4" /> Review
                    </button>
                  )}
                  {(dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW') && (
                    <>
                      <button onClick={() => updateDisputeStatus(dispute.id, 'APPROVED')} className="flex-1 bg-green-600 text-white px-3 py-1.5 text-sm rounded shadow-sm hover:bg-green-700 flex justify-center items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button onClick={() => updateDisputeStatus(dispute.id, 'REJECTED')} className="flex-1 bg-gray-600 text-white px-3 py-1.5 text-sm rounded shadow-sm hover:bg-gray-700 flex justify-center items-center gap-1">
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold dark:text-zinc-100 border-b dark:border-zinc-800 pb-2">Incident Reports</h2>
        {reports.length === 0 ? (
          <p className="text-gray-500 dark:text-zinc-500 italic text-sm">No reports filed for this event.</p>
        ) : (
          <div className="grid gap-4">
            {reports.map(report => (
              <div key={report.id} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      report.status === 'OPEN' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {report.status}
                    </span>
                    <span className="text-sm font-semibold dark:text-zinc-300 uppercase tracking-wider">{report.target_type} REPORT</span>
                    <span className="text-xs text-gray-400">{new Date(report.created_at).toLocaleString()}</span>
                  </div>
                  
                  <h3 className="font-bold text-lg dark:text-zinc-100">{report.reason}</h3>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">{report.description}</p>
                </div>
                
                <div className="flex md:flex-col gap-2 w-full md:w-auto">
                  {report.status === 'OPEN' && (
                    <>
                      <button onClick={() => updateReportStatus(report.id, 'ACTIONED')} className="flex-1 bg-green-600 text-white px-3 py-1.5 text-sm rounded shadow-sm hover:bg-green-700 flex justify-center items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Actioned
                      </button>
                      <button onClick={() => updateReportStatus(report.id, 'DISMISSED')} className="flex-1 bg-gray-600 text-white px-3 py-1.5 text-sm rounded shadow-sm hover:bg-gray-700 flex justify-center items-center gap-1">
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
