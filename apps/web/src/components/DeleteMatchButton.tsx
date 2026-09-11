"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteMatchButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this match? This action cannot be undone.")) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/v1/events/${eventId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete event");
      }
      
      alert("Match deleted successfully!");
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={loading}
      className="bg-error text-on-error px-4 py-2 font-label-caps text-label-caps uppercase tracking-widest flex items-center gap-2 shrink-0 hover:bg-error/80 transition-colors disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">delete</span> 
      {loading ? "Deleting..." : "Delete Match"}
    </button>
  );
}
