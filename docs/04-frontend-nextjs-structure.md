# 04 — Frontend (Next.js, App Router) Structure

## Directory tree

```text
apps/web/
├── app/
│   ├── (public)/                              # server-rendered, cacheable, SEO'd (§107)
│   │   ├── events/[slug]/
│   │   │   ├── page.tsx                       # overview
│   │   │   ├── teams/page.tsx
│   │   │   ├── fixtures/page.tsx
│   │   │   ├── standings/page.tsx
│   │   │   ├── leaderboards/page.tsx
│   │   │   ├── players/page.tsx
│   │   │   ├── referees/page.tsx
│   │   │   ├── rules/page.tsx
│   │   │   └── announcements/page.tsx
│   │   ├── match/[matchId]/page.tsx           # live match centre (spectator view)
│   │   ├── players/[uniqueCode]/page.tsx      # public player profile
│   │   ├── teams/[slug]/page.tsx              # public team profile
│   │   └── explore/page.tsx                   # live now / upcoming / popular (§69, §96)
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── verify/page.tsx
│   │
│   ├── (dashboard)/                           # logged-in, any role
│   │   ├── dashboard/page.tsx
│   │   ├── my-teams/page.tsx
│   │   ├── my-events/page.tsx
│   │   ├── friends/page.tsx
│   │   ├── messages/[conversationId]/page.tsx
│   │   ├── notifications/page.tsx
│   │   ├── activity/page.tsx
│   │   └── settings/privacy/page.tsx
│   │
│   ├── (captain)/
│   │   └── teams/[teamId]/
│   │       ├── roster/page.tsx
│   │       ├── invitations/page.tsx
│   │       └── register/[eventId]/page.tsx    # registration flow, §11
│   │
│   ├── (referee)/
│   │   └── referee/
│   │       ├── assignments/page.tsx
│   │       └── match/[matchId]/page.tsx       # the scorepad — §28, large-touch-target, offline
│   │
│   ├── (admin)/
│   │   └── admin/events/[eventId]/
│   │       ├── page.tsx                       # command centre — §66, §131
│   │       ├── registrations/page.tsx
│   │       ├── schedule/page.tsx              # generator UX — §21
│   │       ├── matchday/page.tsx              # live multi-field board — §131
│   │       ├── officials/page.tsx
│   │       ├── disciplinary/page.tsx          # §103
│   │       ├── disputes/page.tsx
│   │       └── settings/page.tsx              # event_settings + event_stat_definitions editor
│   │
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── ui/                                    # shadcn primitives
│   ├── referee/
│   │   ├── ScorePad.tsx                       # GOAL/CARD/FOUL/SUB big buttons
│   │   ├── MatchClock.tsx                     # displays server-anchored clock — §29
│   │   └── OfflineBanner.tsx
│   ├── match/
│   │   ├── LiveScoreHeader.tsx
│   │   ├── Timeline.tsx
│   │   ├── Lineups.tsx
│   │   └── StatsPanel.tsx
│   ├── events/
│   │   ├── EventCard.tsx
│   │   ├── RegistrationForm.tsx
│   │   ├── ScheduleGeneratorWizard.tsx        # §21 — runs entirely client-side
│   │   └── StandingsTable.tsx
│   ├── teams/
│   │   ├── RosterEditor.tsx
│   │   └── InvitePlayerModal.tsx
│   ├── social/
│   │   ├── FriendList.tsx
│   │   └── ChatWindow.tsx
│   └── shared/
│       ├── Avatar.tsx                         # renders Cloudinary URL w/ transformation params
│       ├── ImageUploader.tsx                  # compress → sign → upload → persist
│       ├── QRCodeBlock.tsx
│       ├── ShareSheet.tsx
│       └── CountdownTimer.tsx                 # §18 — pure client-side
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                          # browser client (anon key + user JWT)
│   │   ├── server.ts                          # server-component client (cookies-based)
│   │   └── realtime.ts                        # typed channel subscribe helpers
│   ├── api/                                   # typed fetch wrappers hitting FastAPI — one per domain
│   │   ├── events.ts
│   │   ├── teams.ts
│   │   ├── matches.ts
│   │   ├── matchEvents.ts
│   │   └── media.ts
│   ├── cloudinary/
│   │   └── upload.ts                          # see sketch below
│   ├── offline/
│   │   ├── indexeddb.ts                       # schema for the referee event queue — §88
│   │   └── syncQueue.ts                       # replay-on-reconnect logic — §89
│   ├── scheduling/
│   │   ├── roundRobinGenerator.ts             # browser generates candidate schedules — §20/§21
│   │   ├── knockoutGenerator.ts
│   │   └── slotCalculator.ts                  # duration math, feasibility warnings — §10
│   ├── stats/
│   │   └── optimisticCalculators.ts           # UI-only projections; never authoritative — §140
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useRealtimeMatch.ts                # subscribes to match_events + matches changes
│   │   ├── usePresence.ts                     # live viewer count — §23
│   │   └── useOfflineQueue.ts
│   ├── types/                                 # mirrors packages/shared-types
│   └── utils/
│
├── middleware.ts                              # route protection by role, reads Supabase session
├── public/
├── next.config.js                             # PWA config
└── package.json
```

## `lib/hooks/useRealtimeMatch.ts`

```ts
export function useRealtimeMatch(matchId: string) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
          () => queryClient.invalidateQueries({ queryKey: ["match", matchId, "timeline"] }))
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
          (payload) => queryClient.setQueryData(["match", matchId], payload.new))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);
}
```

No polling, no custom server — this is the entire "live update" mechanism for spectators,
admins, and the referee's own second device.

## `lib/offline/syncQueue.ts` (referee offline mode, §88–89)

```ts
export async function queueMatchEvent(event: PendingMatchEvent) {
  await db.pendingEvents.add({ ...event, clientEventId: crypto.randomUUID(), queuedAt: Date.now() });
  applyOptimistically(event);           // update in-memory/local UI immediately
  trySync();                            // no-op if offline; picked up by the online listener too
}

export async function trySync() {
  if (!navigator.onLine) return;
  const pending = await db.pendingEvents.orderBy("queuedAt").toArray();
  for (const event of pending) {
    try {
      await postMatchEvent(event.matchId, event);   // same client_event_id every retry
      await db.pendingEvents.delete(event.id);
    } catch (err) {
      if (isNetworkError(err)) break;                // stop, retry later
      await db.pendingEvents.update(event.id, { lastError: String(err) }); // surface to UI
    }
  }
}
```

## `lib/cloudinary/upload.ts`

```ts
export async function uploadImage(file: File, ownerType: MediaOwnerType, ownerId: string) {
  const compressed = await imageCompression(file, { maxWidthOrHeight: 1600, maxSizeMB: 1 });

  const { data: sig } = await api.post("/media/signature", { ownerType, ownerId });

  const form = new FormData();
  form.append("file", compressed);
  form.append("api_key", sig.api_key);
  form.append("timestamp", sig.timestamp);
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  form.append("tags", sig.tags);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, { method: "POST", body: form }
  );
  const uploaded = await res.json();

  // Ownership check happens via RLS on this insert (auth.uid() must own ownerId)
  return supabase.from("media_assets").insert({
    owner_type: ownerType, owner_id: ownerId,
    cloudinary_public_id: uploaded.public_id, secure_url: uploaded.secure_url,
    resource_type: "image", width: uploaded.width, height: uploaded.height,
    format: uploaded.format, bytes: uploaded.bytes, uploaded_by: currentUserId(),
  });
}
```

Full flow explained in doc 06. Note the file itself never touches FastAPI or Next.js
server — it goes browser → Cloudinary directly, exactly like the brief's original
"don't send 8 MB images through your backend" rule (§80), just with Cloudinary instead of
Supabase Storage.

## `middleware.ts`

Reads the Supabase session cookie and gates `(dashboard)`, `(captain)`, `(referee)`, `(admin)`
route groups; redirects unauthenticated users to `(auth)/login`. Role-specific gating
(e.g. "is this user actually a referee for *this* match") still happens again at the data-fetch
level via RLS/FastAPI — middleware is a UX convenience, never the security boundary.

## PWA

`next.config.js` wraps the app with a service worker (precache the referee route shell +
runtime-cache `GET` calls to `match_events`/`matches` reads) so `(referee)/referee/match/[id]`
keeps rendering even if the tab is reopened with no signal. Actual event durability comes from
the IndexedDB queue above, not the service worker cache.
