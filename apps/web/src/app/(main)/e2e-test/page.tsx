"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function E2ETestPage() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, [supabase.auth]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) addLog(`Login Error: ${error.message}`);
    else addLog(`Logged in as ${email}`);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    addLog("Logged out");
  };

  const createEvent = async () => {
    try {
      const res = await fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "E2E Event",
          description: "Testing"
        })
      });
      const data = await res.json();
      addLog(`Created Event: ${data.id}`);
    } catch (e: any) {
      addLog(`Error creating event: ${e.message}`);
    }
  };

  const openRegistration = async (eventId: string) => {
    try {
      const res = await fetch(`/api/v1/events/${eventId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REGISTRATION_OPEN" })
      });
      addLog(`Registration opened: ${res.status}`);
    } catch (e: any) {
      addLog(`Error opening registration: ${e.message}`);
    }
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("*");
    setEvents(data || []);
  };

  const createTeam = async () => {
    const { data, error } = await supabase.from("teams").insert({ name: "E2E Team" }).select().single();
    if (error) addLog(`Create Team Error: ${error.message}`);
    else addLog(`Created Team: ${data.id}`);
  };

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("*");
    setTeams(data || []);
  };

  const inviteFriend = async (teamId: string, friendEmail: string) => {
    // Note: requires knowing friend's user ID. In a real app we lookup by email.
    // For E2E we can fetch from a test endpoint or just let Playwright do it via db.
    // Let's create an RPC or just let Playwright do it.
    addLog("Invite Friend not fully implemented in UI, rely on backend or proper lookup");
  };

  const acceptInvite = async (teamId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("team_members").update({ status: "ACCEPTED" })
      .eq("team_id", teamId)
      .eq("user_id", user.id);
    if (error) addLog(`Accept Invite Error: ${error.message}`);
    else addLog(`Accepted invite to team ${teamId}`);
  };

  const registerForEvent = async (eventId: string, teamId: string) => {
    try {
      const res = await fetch(`/api/v1/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId })
      });
      const data = await res.json();
      addLog(`Registered Team: ${data.id}`);
    } catch (e: any) {
      addLog(`Error registering: ${e.message}`);
    }
  };

  const fetchRegistrations = async (eventId: string) => {
    const { data } = await supabase.from("event_team_registrations").select("*").eq("event_id", eventId);
    setRegistrations(data || []);
  };

  const addToRoster = async (eventId: string, registrationId: string, userId: string) => {
    try {
      const res = await fetch(`/api/v1/events/${eventId}/registrations/${registrationId}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      if (!res.ok) addLog(`Error adding to roster: ${JSON.stringify(data)}`);
      else addLog(`Added ${userId} to roster`);
    } catch (e: any) {
      addLog(`Error adding to roster: ${e.message}`);
    }
  };

  const approveRegistration = async (eventId: string, registrationId: string) => {
    try {
      const res = await fetch(`/api/v1/events/${eventId}/registrations/${registrationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" })
      });
      const data = await res.json();
      addLog(`Approved registration: ${res.status}`);
    } catch (e: any) {
      addLog(`Error approving: ${e.message}`);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold" data-testid="page-title">E2E Test Harness</h1>
      
      <div className="border p-4">
        <h2 className="font-bold">Auth (Current: {session?.user?.email || "None"})</h2>
        <input data-testid="login-email" className="border p-1 mr-2 text-black" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input data-testid="login-password" type="password" className="border p-1 mr-2 text-black" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
        <button data-testid="login-btn" onClick={login} className="bg-blue-500 text-white px-2 py-1 mr-2">Login</button>
        <button data-testid="logout-btn" onClick={logout} className="bg-red-500 text-white px-2 py-1">Logout</button>
      </div>

      <div className="border p-4">
        <h2 className="font-bold">Events (Organizer)</h2>
        <button data-testid="create-event-btn" onClick={createEvent} className="bg-green-500 text-white px-2 py-1 mr-2">Create Event</button>
        <button data-testid="fetch-events-btn" onClick={fetchEvents} className="bg-gray-500 text-white px-2 py-1 mr-2">Fetch Events</button>
        <div data-testid="events-list">
          {events.map(ev => (
            <div key={ev.id} className="text-sm mt-2">
              {ev.id} - {ev.status} 
              <button data-testid={`open-reg-${ev.id}`} onClick={() => openRegistration(ev.id)} className="ml-2 bg-yellow-500 text-white px-1">Open Reg</button>
            </div>
          ))}
        </div>
      </div>

      <div className="border p-4">
        <h2 className="font-bold">Teams (Captain/Player)</h2>
        <button data-testid="create-team-btn" onClick={createTeam} className="bg-green-500 text-white px-2 py-1 mr-2">Create Team</button>
        <button data-testid="fetch-teams-btn" onClick={fetchTeams} className="bg-gray-500 text-white px-2 py-1 mr-2">Fetch Teams</button>
        <div data-testid="teams-list">
          {teams.map(t => (
            <div key={t.id} className="text-sm mt-2">
              {t.id} - {t.name}
              <button data-testid={`accept-invite-${t.id}`} onClick={() => acceptInvite(t.id)} className="ml-2 bg-yellow-500 text-white px-1">Accept Invite</button>
            </div>
          ))}
        </div>
      </div>

      <div className="border p-4">
        <h2 className="font-bold">Registration Actions</h2>
        <div className="text-sm">
          Use the DevTools console or backend directly for complex flows if needed, or implement inputs below:
        </div>
        <div className="flex flex-col gap-2 mt-2 max-w-sm">
          <input id="ev-id" className="border p-1 text-black" placeholder="Event ID" />
          <input id="tm-id" className="border p-1 text-black" placeholder="Team ID" />
          <button data-testid="register-team-btn" onClick={() => registerForEvent(
            (document.getElementById("ev-id") as HTMLInputElement).value,
            (document.getElementById("tm-id") as HTMLInputElement).value
          )} className="bg-blue-500 text-white px-2 py-1">Register Team</button>

          <input id="reg-id" className="border p-1 text-black" placeholder="Registration ID" />
          <input id="usr-id" className="border p-1 text-black" placeholder="User ID" />
          <button data-testid="add-roster-btn" onClick={() => addToRoster(
            (document.getElementById("ev-id") as HTMLInputElement).value,
            (document.getElementById("reg-id") as HTMLInputElement).value,
            (document.getElementById("usr-id") as HTMLInputElement).value
          )} className="bg-blue-500 text-white px-2 py-1">Add to Roster</button>

          <button data-testid="approve-reg-btn" onClick={() => approveRegistration(
            (document.getElementById("ev-id") as HTMLInputElement).value,
            (document.getElementById("reg-id") as HTMLInputElement).value
          )} className="bg-green-500 text-white px-2 py-1">Approve Registration</button>
        </div>
      </div>

      <div className="border p-4 bg-gray-900 text-green-400 font-mono text-sm h-64 overflow-y-auto">
        <h2 className="font-bold text-white mb-2">Logs</h2>
        {log.map((l, i) => <div key={i} data-testid="log-msg">{l}</div>)}
      </div>
    </div>
  );
}
