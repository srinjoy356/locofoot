"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateEventPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const res = await fetch("/api/v1/events", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}` 
      },
      body: JSON.stringify({ name, description })
    });
    
    if (res.ok) {
      const event = await res.json();
      router.push(`/admin/events/${event.id}`);
    } else {
      alert("Failed to create event");
    }
  }

  return (
    <div className="max-w-lg mx-auto border p-6 rounded bg-white mt-10">
      <h1 className="text-2xl font-bold mb-4">Create Event</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input required className="w-full border p-2 rounded" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea required className="w-full border p-2 rounded" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <button className="bg-black text-white px-4 py-2 rounded w-full">Create Event</button>
      </form>
    </div>
  );
}
