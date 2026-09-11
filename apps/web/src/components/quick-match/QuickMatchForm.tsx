"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocoFootApi } from "@/lib/api/hooks/useLocoFootApi";

export default function QuickMatchForm() {
  const router = useRouter();
  const api = useLocoFootApi();
  const [loading, setLoading] = useState(false);

  const [matchName, setMatchName] = useState("Quick Match");
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");

  // Arrays of { id: string } or { guest_name: string }
  const [teamAPlayers, setTeamAPlayers] = useState<any[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<any[]>([]);
  const [refereeId, setRefereeId] = useState("");
  const [scorerId, setScorerId] = useState("");

  const [tempPlayerA, setTempPlayerA] = useState("");
  const [tempPlayerB, setTempPlayerB] = useState("");

  const handleAddPlayer = (team: "A" | "B", nameOrId: string) => {
    if (!nameOrId.trim()) return;
    const playerObj = { guest_name: nameOrId.trim() }; // for now only ghost players for simplicity in this basic UI
    if (team === "A") {
      setTeamAPlayers([...teamAPlayers, playerObj]);
      setTempPlayerA("");
    } else {
      setTeamBPlayers([...teamBPlayers, playerObj]);
      setTempPlayerB("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        match_name: matchName,
        referee_id: refereeId || null,
        scorer_id: scorerId || null,
        team_a: {
          name: teamAName,
          players: teamAPlayers
        },
        team_b: {
          name: teamBName,
          players: teamBPlayers
        }
      };

      const { data, error } = await api.post("/api/v1/quick-match", payload);
      if (error) throw new Error(error.message || "Failed to create quick match");
      
      router.push(`/matches/${data.match_id}/control`);
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
              placeholder="User UUID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Scorer ID (Optional)</label>
            <input 
              className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface"
              value={scorerId}
              onChange={(e) => setScorerId(e.target.value)}
              placeholder="User UUID"
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-surface-container p-6 border border-outline-variant">
          <h2 className="font-label-caps uppercase text-on-surface-variant mb-4">Team A</h2>
          <input 
            className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface font-bold text-lg mb-4"
            value={teamAName}
            onChange={(e) => setTeamAName(e.target.value)}
          />
          
          <div className="flex gap-2 mb-4">
            <input 
              className="flex-1 bg-background border-outline-variant px-3 py-2"
              placeholder="Type player name..."
              value={tempPlayerA}
              onChange={(e) => setTempPlayerA(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPlayer("A", tempPlayerA))}
            />
            <button type="button" onClick={() => handleAddPlayer("A", tempPlayerA)} className="bg-primary-container text-on-primary-container px-4 font-bold">Add</button>
          </div>

          <ul className="flex flex-col gap-2">
            {teamAPlayers.map((p, i) => (
              <li key={i} className="bg-background px-3 py-2 flex justify-between">
                <span>{p.guest_name}</span>
                <span className="text-xs bg-surface-variant px-2 py-1 uppercase">Guest</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-surface-container p-6 border border-outline-variant">
          <h2 className="font-label-caps uppercase text-on-surface-variant mb-4">Team B</h2>
          <input 
            className="w-full bg-background border-outline-variant px-3 py-2 text-on-surface font-bold text-lg mb-4"
            value={teamBName}
            onChange={(e) => setTeamBName(e.target.value)}
          />
          
          <div className="flex gap-2 mb-4">
            <input 
              className="flex-1 bg-background border-outline-variant px-3 py-2"
              placeholder="Type player name..."
              value={tempPlayerB}
              onChange={(e) => setTempPlayerB(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPlayer("B", tempPlayerB))}
            />
            <button type="button" onClick={() => handleAddPlayer("B", tempPlayerB)} className="bg-primary-container text-on-primary-container px-4 font-bold">Add</button>
          </div>

          <ul className="flex flex-col gap-2">
            {teamBPlayers.map((p, i) => (
              <li key={i} className="bg-background px-3 py-2 flex justify-between">
                <span>{p.guest_name}</span>
                <span className="text-xs bg-surface-variant px-2 py-1 uppercase">Guest</span>
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
