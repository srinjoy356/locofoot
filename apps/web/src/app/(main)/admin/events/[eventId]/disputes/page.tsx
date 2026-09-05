'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileWarning, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
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
    <div className="w-full bg-background min-h-[calc(100vh-64px)] text-on-surface">
      {/* Top Bar */}
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center justify-between">
          <Link href={`/admin/events/${eventId}`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft size={16} />
            <span className="font-label-caps text-label-caps uppercase tracking-widest">EVENT DASHBOARD</span>
          </Link>
        </div>
      </div>

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-12">
        <div className="relative overflow-hidden border border-outline-variant bg-[#151816]">
          <div className="absolute inset-0 z-0">
            <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-25 " src="/turf/stadium.jpg" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40 z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          </div>
          <div className="relative z-20 p-6 md:p-8">
            <span className="mb-3 flex items-center gap-2 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
              <FileWarning size={14} /> Event Operations
            </span>
            <h1 className="font-display-lg text-display-lg md:text-[56px] uppercase tracking-tighter leading-none text-on-surface">
              Disputes & Reports
            </h1>
            <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 max-w-xl">
              Review and resolve official disputes and referee/player reports.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-2">Active Disputes</h2>
          {disputes.length === 0 ? (
            <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">No disputes filed for this event.</p>
          ) : (
            <div className="grid gap-4">
              {disputes.map(dispute => (
                <div key={dispute.id} className="bg-surface border border-outline-variant p-4 flex flex-col md:flex-row gap-4 justify-between items-start">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`font-label-caps text-[10px] uppercase tracking-widest px-2 py-1 border ${
                        dispute.status === 'OPEN' ? 'border-error bg-error/10 text-error' :
                        dispute.status === 'UNDER_REVIEW' ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400' :
                        'border-primary-container bg-primary-container/10 text-primary-container'
                      }`}>
                        {dispute.status}
                      </span>
                      <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-widest">{dispute.target_type} DISPUTE</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">{new Date(dispute.created_at).toLocaleString()}</span>
                    </div>

                    <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">{dispute.reason}</h3>
                    <p className="font-body-sm text-on-surface-variant mt-1">{dispute.description}</p>

                    {dispute.target_type === 'MATCH' && dispute.match_id && (
                      <div className="mt-3 border border-outline-variant bg-background p-3 font-body-sm text-on-surface">
                        <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Match in Question:</span>
                        {' '}{dispute.matches?.home_team?.team_name || 'TBD'} vs {dispute.matches?.away_team?.team_name || 'TBD'}
                        <div className="mt-2 flex flex-wrap gap-4">
                          <Link href={`/admin/events/${eventId}/matches/${dispute.match_id}/recorder`} className="text-primary-container hover:text-primary-fixed font-label-caps text-[10px] uppercase tracking-widest transition-colors">
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
                              className="text-yellow-400 hover:text-yellow-400/80 font-label-caps text-[10px] uppercase tracking-widest transition-colors"
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
                              className="text-primary-container hover:text-primary-fixed font-label-caps text-[10px] uppercase tracking-widest flex items-center gap-1 transition-colors"
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
                      <button onClick={() => updateDisputeStatus(dispute.id, 'UNDER_REVIEW')} className="flex-1 border border-yellow-400 text-yellow-400 px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-yellow-400/10 flex justify-center items-center gap-1 transition-colors">
                        <Clock className="w-4 h-4" /> Review
                      </button>
                    )}
                    {(dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW') && (
                      <>
                        <button onClick={() => updateDisputeStatus(dispute.id, 'APPROVED')} className="flex-1 bg-primary-container text-on-primary-container px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-primary-fixed flex justify-center items-center gap-1 transition-colors">
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => updateDisputeStatus(dispute.id, 'REJECTED')} className="flex-1 border border-outline-variant text-on-surface px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-surface-variant flex justify-center items-center gap-1 transition-colors">
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
          <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-2">Incident Reports</h2>
          {reports.length === 0 ? (
            <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">No reports filed for this event.</p>
          ) : (
            <div className="grid gap-4">
              {reports.map(report => (
                <div key={report.id} className="bg-surface border border-outline-variant p-4 flex flex-col md:flex-row gap-4 justify-between items-start">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`font-label-caps text-[10px] uppercase tracking-widest px-2 py-1 border ${
                        report.status === 'OPEN' ? 'border-error bg-error/10 text-error' :
                        'border-primary-container bg-primary-container/10 text-primary-container'
                      }`}>
                        {report.status}
                      </span>
                      <span className="font-label-caps text-[10px] text-on-surface uppercase tracking-widest">{report.target_type} REPORT</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">{new Date(report.created_at).toLocaleString()}</span>
                    </div>

                    <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">{report.reason}</h3>
                    <p className="font-body-sm text-on-surface-variant mt-1">{report.description}</p>
                  </div>

                  <div className="flex md:flex-col gap-2 w-full md:w-auto">
                    {report.status === 'OPEN' && (
                      <>
                        <button onClick={() => updateReportStatus(report.id, 'ACTIONED')} className="flex-1 bg-primary-container text-on-primary-container px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-primary-fixed flex justify-center items-center gap-1 transition-colors">
                          <CheckCircle className="w-4 h-4" /> Actioned
                        </button>
                        <button onClick={() => updateReportStatus(report.id, 'DISMISSED')} className="flex-1 border border-outline-variant text-on-surface px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-surface-variant flex justify-center items-center gap-1 transition-colors">
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
    </div>
  );
}
