import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type QueuedEvent = {
  id: string; // client UUID, doubles as the server idempotency key
  payload: Record<string, any>;
  label: string; // human description for the recent list
  status: 'sending' | 'queued' | 'failed' | 'saved';
  error?: string;
};

const RETRY_MS = 4000;
export const SIGNED_OUT = 'Signed out. Log in again, this event is kept.';
const key = (matchId: string) => `rec_queue_${matchId}`;

const readStored = (matchId: string): QueuedEvent[] => {
  try {
    return JSON.parse(localStorage.getItem(key(matchId)) || '[]');
  } catch {
    return [];
  }
};

/**
 * Pitch-side connections drop. Every recorded event goes into a persisted queue and is re-sent until the API
 * confirms it. The client UUID makes retries safe (the API answers `duplicate` instead of inserting twice).
 * 4xx answers are not retried: the event is marked failed so the recorder sees it instead of losing it silently.
 */
export function useEventQueue(eventId: string, matchId: string) {
  const [items, setItems] = useState<QueuedEvent[]>([]);
  const itemsRef = useRef<QueuedEvent[]>([]);
  const flushing = useRef(false);

  const commit = useCallback((next: QueuedEvent[]) => {
    itemsRef.current = next;
    setItems(next);
    try {
      // saved events need not survive a reload
      localStorage.setItem(key(matchId), JSON.stringify(next.filter((i) => i.status !== 'saved')));
    } catch {
      /* storage full or blocked: the in-memory queue still works */
    }
  }, [matchId]);

  const patch = useCallback((id: string, changes: Partial<QueuedEvent>) => {
    commit(itemsRef.current.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }, [commit]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      // everything waiting goes out in one request, oldest first, so a burst of taps costs one round trip
      for (let guard = 0; guard < 20; guard++) {
        const batch = itemsRef.current.filter((i) => i.status === 'queued' || i.status === 'sending').slice(0, 50);
        if (batch.length === 0) break;
        commit(itemsRef.current.map((i) => (batch.some((b) => b.id === i.id) ? { ...i, status: 'sending' as const } : i)));
        const set = (id: string, changes: Partial<QueuedEvent>) => patch(id, changes);
        try {
          const { data: { session } } = await createClient().auth.getSession();
          const res = await fetch(`/api/v1/events/${eventId}/matches/${matchId}/timeline/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
            body: JSON.stringify({ events: batch.map((i) => i.payload) }),
          });
          if (res.ok) {
            const { results } = await res.json();
            const byId = new Map<string, any>(results.map((r: any) => [r.id, r]));
            for (const item of batch) {
              const r = byId.get(item.id);
              if (r && r.status === 'error') set(item.id, { status: 'failed', error: r.message || 'Rejected by the server' });
              else set(item.id, { status: 'saved', error: undefined });
            }
          } else if (res.status === 401 || res.status >= 500 || res.status === 408 || res.status === 429) {
            // 401: the login expired. Events are kept and go out once the recorder signs in again.
            for (const item of batch) set(item.id, { status: 'queued', error: res.status === 401 ? SIGNED_OUT : `Server busy (${res.status}), retrying` });
            break;
          } else {
            const body = await res.json().catch(() => ({}));
            const message = typeof body.detail === 'string' ? body.detail : body.detail?.message || `Rejected (${res.status})`;
            for (const item of batch) set(item.id, { status: 'failed', error: message });
          }
        } catch {
          for (const item of batch) set(item.id, { status: 'queued', error: 'Offline, will retry' });
          break;
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [eventId, matchId, patch, commit]);

  useEffect(() => {
    commit(readStored(matchId).map((i) => ({ ...i, status: 'queued' as const })));
    flush();
    const timer = setInterval(flush, RETRY_MS);
    window.addEventListener('online', flush);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', flush);
    };
  }, [matchId, commit, flush]);

  const submit = useCallback((payload: Record<string, any>, label: string) => {
    commit([...itemsRef.current, { id: payload.id, payload, label, status: 'queued' as const }].slice(-60));
    flush();
  }, [commit, flush]);

  const discard = useCallback((id: string) => commit(itemsRef.current.filter((i) => i.id !== id)), [commit]);
  const retry = useCallback((id: string) => { patch(id, { status: 'queued', error: undefined }); flush(); }, [patch, flush]);

  return {
    items,
    unsent: items.filter((i) => i.status !== 'saved' && i.status !== 'failed').length,
    failed: items.filter((i) => i.status === 'failed').length,
    signedOut: items.some((i) => i.error === SIGNED_OUT),
    submit,
    discard,
    retry,
  };
}
