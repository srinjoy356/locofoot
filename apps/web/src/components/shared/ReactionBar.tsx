'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const REACTIONS = [
  { key: 'goal', icon: '⚽', label: 'Goal' },
  { key: 'fire', icon: '🔥', label: 'Fire' },
  { key: 'clap', icon: '👏', label: 'Clap' },
  { key: 'wow', icon: '😮', label: 'Wow' },
  { key: 'ouch', icon: '😬', label: 'Ouch' },
];

type Float = { id: number; icon: string; left: number };

/**
 * Live crowd reactions. Nothing is stored: reactions travel over a Supabase broadcast channel, so every spectator
 * on the match page sees the emojis rise at the same moment and the counters tick up.
 */
export function ReactionBar({ matchId }: { matchId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [floats, setFloats] = useState<Float[]>([]);
  const [watching, setWatching] = useState(1);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const seq = useRef(0);
  const lastSent = useRef(0);

  const show = (key: string) => {
    const r = REACTIONS.find((x) => x.key === key);
    if (!r) return;
    const id = ++seq.current;
    setCounts((c) => ({ ...c, [key]: (c[key] || 0) + 1 }));
    setFloats((f) => [...f.slice(-14), { id, icon: r.icon, left: 8 + Math.random() * 84 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2200);
  };

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`reactions:${matchId}`, { config: { broadcast: { self: false }, presence: { key: crypto.randomUUID() } } });
    channel
      .on('broadcast', { event: 'react' }, ({ payload }) => show(payload.key))
      .on('presence', { event: 'sync' }, () => setWatching(Math.max(1, Object.keys(channel.presenceState()).length)))
      .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ at: Date.now() }); });
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [matchId]);

  const send = (key: string) => {
    const now = Date.now();
    if (now - lastSent.current < 250) return; // a little throttle so nobody floods the channel
    lastSent.current = now;
    show(key);
    channelRef.current?.send({ type: 'broadcast', event: 'react', payload: { key } });
  };

  return (
    <div className="relative border border-outline-variant bg-surface px-4 py-3" aria-label="Live reactions">
      <div className="pointer-events-none absolute inset-x-0 bottom-full h-40 overflow-hidden" aria-hidden="true">
        {floats.map((f) => (
          <span key={f.id} className="absolute bottom-0 text-2xl" style={{ left: `${f.left}%`, animation: 'react-rise 2.2s ease-out forwards' }}>{f.icon}</span>
        ))}
      </div>
      <style>{`@keyframes react-rise { 0% { transform: translateY(0) scale(.6); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(-140px) scale(1.2); opacity: 0 } }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {REACTIONS.map((r) => (
            <button key={r.key} onClick={() => send(r.key)} aria-label={r.label}
              className="flex items-center gap-1 border border-outline-variant px-3 py-2 text-lg transition-transform hover:bg-surface-variant active:scale-90">
              <span>{r.icon}</span>
              <span className="font-mono text-[11px] text-on-surface-variant tabular-nums">{counts[r.key] || 0}</span>
            </button>
          ))}
        </div>
        <span className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">{watching} watching now</span>
      </div>
    </div>
  );
}
