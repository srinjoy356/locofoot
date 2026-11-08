import { createClient } from '@/lib/supabase/client';

/** fetch against the FastAPI backend (proxied at /api) with the signed-in user's token when there is one */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await createClient().auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(path, { ...init, headers });
}

export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await apiFetch(path, init);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
