"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function QuickMatchForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [matchName, setMatchName] = useState("Quick Match");
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");

  // Arrays of { user_id?: string, guest_name?: string }
  const [teamAPlayers, setTeamAPlayers] = useState<any[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<any[]>([]);
  const [refereeId, setRefereeId] = useState("");
  const [scorerId, setScorerId] = useState("");

  const [playersOnField, setPlayersOnField] = useState(5);
  const [substitutesAllowed, setSubstitutesAllowed] = useState(3);
  const [firstHalfMinutes, setFirstHalfMinutes] = useState(15);
  const [secondHalfMinutes, setSecondHalfMinutes] = useState(15);

  const [tempPlayerA, setTempPlayerA] = useState("");
  const [typeA, setTypeA] = useState<"GUEST" | "USER_ID">("GUEST");
  
  const [tempPlayerB, setTempPlayerB] = useState("");
  const [typeB, setTypeB] = useState<"GUEST" | "USER_ID">("GUEST");

  const handleAddPlayer = (team: "A" | "B", value: string, type: "GUEST" | "USER_ID") => {
    if (!value.trim()) return;
    const playerObj = type === "GUEST" 
      ? { guest_name: value.trim() } 
      : { user_id: value.trim() };
      
    if (team === "A") {
      setTeamAPlayers([...teamAPlayers, playerObj]);
      setTempPlayerA("");
    } else {
      setTeamBPlayers([...teamBPlayers, playerObj]);
      setTempPlayerB("");
    }
  };

  const handleRemovePlayer = (team: "A" | "B", index: number) => {
    if (team === "A") {
      setTeamAPlayers(prev => prev.filter((_, i) => i !== index));
    } else {
      setTeamBPlayers(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = {
        match_name: matchName,
        referee_id: refereeId || null,
        scorer_id: scorerId || null,
        players_on_field: playersOnField,
        substitutes_allowed: substitutesAllowed,
        first_half_minutes: firstHalfMinutes,
        second_half_minutes: secondHalfMinutes,
        team_a: {
          name: teamAName,
          players: teamAPlayers
        },
        team_b: {
          name: teamBName,
          players: teamBPlayers
        }
      };

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/v1/quick-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create quick match");
      }
      
      const data = await res.json();
      router.push(`/events/${data.event_slug || data.event_id}/matches/${data.match_id}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 flex flex-col gap-8">
      <h1 className="text-3xl font-display uppercase tracking-tight text-on-surface">Start Quick Match</h1>
      
      <section className="bg-surface-container p-6 border border-outline-variant">
        <h2 className="font-label-caps uppercase text-on-surface-variant mb-4">Match Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Match Name</label>
            <input 
              className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface"
              value={matchName}
              onChange={(e) => setMatchName(e.target.value)}
              placeholder="e.g. Friday Pickup"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Referee ID (Optional)</label>
            <input 
              className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface"
              value={refereeId}
              onChange={(e) => setRefereeId(e.target.value)}
              placeholder="User Unique Code"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Scorer ID (Optional)</label>
            <input 
              className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface"
              value={scorerId}
              onChange={(e) => setScorerId(e.target.value)}
              placeholder="User Unique Code"
            />
          </div>
        </div>

        <h3 className="font-label-caps uppercase text-on-surface-variant mt-8 mb-4">Match Rules</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Players on Field</label>
            <input 
              type="number"
              min="1"
              className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface"
              value={playersOnField}
              onChange={(e) => setPlayersOnField(parseInt(e.target.value) || 5)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Substitutes Allowed</label>
            <input 
              type="number"
              min="0"
              className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface"
              value={substitutesAllowed}
              onChange={(e) => setSubstitutesAllowed(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">1st Half (mins)</label>
            <input 
              type="number"
              min="1"
              className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface"
              value={firstHalfMinutes}
              onChange={(e) => setFirstHalfMinutes(parseInt(e.target.value) || 15)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">2nd Half (mins)</label>
            <input 
              type="number"
              min="1"
              className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface"
              value={secondHalfMinutes}
              onChange={(e) => setSecondHalfMinutes(parseInt(e.target.value) || 15)}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-surface-container p-6 border border-outline-variant flex flex-col h-full">
          <h2 className="font-label-caps uppercase text-on-surface-variant mb-4">Team A</h2>
          <input 
            className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface font-bold text-lg mb-4"
            value={teamAName}
            onChange={(e) => setTeamAName(e.target.value)}
          />
          
          <div className="flex gap-2 mb-4">
            <select 
              value={typeA} 
              onChange={(e) => setTypeA(e.target.value as "GUEST" | "USER_ID")}
              className="bg-background border-outline-variant px-2 py-2 text-sm"
            >
              <option value="GUEST">Guest Name</option>
              <option value="USER_ID">User Unique Code</option>
            </select>
            <input 
              className="flex-1 bg-background border-outline-variant px-3 py-2 text-on-surface min-w-0"
              placeholder={typeA === "GUEST" ? "Type player name..." : "Paste Unique Code"}
              value={tempPlayerA}
              onChange={(e) => setTempPlayerA(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPlayer("A", tempPlayerA, typeA))}
            />
            <button type="button" onClick={() => handleAddPlayer("A", tempPlayerA, typeA)} className="bg-primary-container text-on-primary-container px-4 font-bold shrink-0">Add</button>
          </div>

          <ul className="flex flex-col gap-2 flex-1">
            {teamAPlayers.map((p, i) => (
              <li key={i} className="bg-background px-3 py-2 flex items-center justify-between group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-xs bg-surface-variant px-2 py-1 uppercase shrink-0">{p.guest_name ? "Guest" : "Registered"}</span>
                  <span className="truncate">{p.guest_name || p.user_id}</span>
                </div>
                <button type="button" onClick={() => handleRemovePlayer("A", i)} className="text-error text-xs font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-surface-container p-6 border border-outline-variant flex flex-col h-full">
          <h2 className="font-label-caps uppercase text-on-surface-variant mb-4">Team B</h2>
          <input 
            className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface font-bold text-lg mb-4"
            value={teamBName}
            onChange={(e) => setTeamBName(e.target.value)}
          />
          
          <div className="flex gap-2 mb-4">
            <select 
              value={typeB} 
              onChange={(e) => setTypeB(e.target.value as "GUEST" | "USER_ID")}
              className="bg-background border-outline-variant px-2 py-2 text-sm"
            >
              <option value="GUEST">Guest Name</option>
              <option value="USER_ID">User Unique Code</option>
            </select>
            <input 
              className="flex-1 bg-background border-outline-variant px-3 py-2 text-on-surface min-w-0"
              placeholder={typeB === "GUEST" ? "Type player name..." : "Paste Unique Code"}
              value={tempPlayerB}
              onChange={(e) => setTempPlayerB(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPlayer("B", tempPlayerB, typeB))}
            />
            <button type="button" onClick={() => handleAddPlayer("B", tempPlayerB, typeB)} className="bg-primary-container text-on-primary-container px-4 font-bold shrink-0">Add</button>
          </div>

          <ul className="flex flex-col gap-2 flex-1">
            {teamBPlayers.map((p, i) => (
              <li key={i} className="bg-background px-3 py-2 flex items-center justify-between group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-xs bg-surface-variant px-2 py-1 uppercase shrink-0">{p.guest_name ? "Guest" : "Registered"}</span>
                  <span className="truncate">{p.guest_name || p.user_id}</span>
                </div>
                <button type="button" onClick={() => handleRemovePlayer("B", i)} className="text-error text-xs font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-primary-container text-on-primary-container py-4 font-display text-xl uppercase tracking-widest disabled:opacity-50"
      >
        {loading ? "Creating..." : "Start Quick Match"}
      </button>
    </form>
  );
}
