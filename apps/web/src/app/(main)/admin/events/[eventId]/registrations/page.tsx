"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function AdminEventRegistrationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const supabase = createClient();

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/v1/events/${eventId}/registrations`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setRegistrations(data);
    }
  }

  useEffect(() => { loadData(); }, [eventId, supabase]);

  async function changeStatus(regId: string, status: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/v1/events/${eventId}/registrations/${regId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status })
    });
    if (res.ok) loadData();
    else alert("Failed to change status: " + JSON.stringify(await res.json()));
  }

  async function unlockRoster(regId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/v1/events/${eventId}/registrations/${regId}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (res.ok) loadData();
    else alert("Failed to unlock: " + JSON.stringify(await res.json()));
  }

  async function lockRoster(regId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/v1/events/${eventId}/registrations/${regId}/lock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (res.ok) loadData();
    else alert("Failed to lock: " + JSON.stringify(await res.json()));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/admin/events/${eventId}`} className="text-gray-500 hover:text-black">← Back to Event</Link>
        <h1 className="text-2xl font-bold">Team Registrations</h1>
      </div>

      <div className="grid gap-6">
        {registrations.map(reg => (
          <div key={reg.id} className="border p-4 rounded bg-white space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{reg.team_name}</h3>
                <p className="text-sm text-gray-500">Status: {reg.status} {reg.roster_locked && '🔒 (Locked)'}</p>
              </div>
              <div className="flex gap-2">
                {(reg.status === 'PENDING_APPROVAL' || reg.status === 'APPROVED') && (
                  <button onClick={() => changeStatus(reg.id, 'DRAFT')} className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm hover:bg-gray-300">Revert to Draft</button>
                )}
                {reg.status === 'PENDING_APPROVAL' && (
                  <button onClick={() => changeStatus(reg.id, 'APPROVED')} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Approve</button>
                )}
                {!reg.roster_locked && (
                  <button onClick={() => lockRoster(reg.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Lock Roster</button>
                )}
                {reg.roster_locked && (
                  <button onClick={() => unlockRoster(reg.id)} className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200">Unlock Roster</button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded p-3 text-sm">
              <h4 className="font-semibold mb-2">Roster ({reg.players?.length || 0} players)</h4>
              <ul className="grid grid-cols-2 gap-2">
                {reg.players?.map((p: any) => (
                  <li key={p.id} className="flex gap-2 items-center">
                    <span className="w-8 text-center bg-gray-200 rounded">{p.jersey_number || '-'}</span>
                    <span className="font-medium">{p.user?.display_name || p.user?.email}</span>
                    {p.is_captain && <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">C</span>}
                    {p.is_vice_captain && <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">VC</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
        {registrations.length === 0 && <p className="text-gray-500">No registrations found.</p>}
      </div>
    </div>
  );
}
