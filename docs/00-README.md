# Football Tournament Platform — Implementation Plan

This is the build blueprint derived from the product/architecture brief. It turns the 142-point
concept doc into concrete tables, files, endpoints, and sequencing. Read it in this order:

| # | Document | What it contains |
|---|----------|-------------------|
| 01 | `01-architecture-overview.md` | The four engines, the browser/Supabase/FastAPI split, the goal-event request flow, tech stack + rationale |
| 02 | `02-database-schema.md` | Every Postgres table, columns, enums, indexes, RLS pattern, trigger/function list |
| 03 | `03-backend-fastapi-structure.md` | Full FastAPI repo tree, what logic lives in every file, key code sketches |
| 04 | `04-frontend-nextjs-structure.md` | Full Next.js (App Router) repo tree, what logic lives in every file/route, key code sketches |
| 05 | `05-api-reference.md` | Every FastAPI endpoint (method, path, auth, request/response) grouped by domain, plus which operations skip FastAPI entirely and go straight through Supabase+RLS |
| 06 | `06-realtime-state-machines-and-media.md` | Supabase Realtime channel design, match/event state machines, idempotency + offline sync design, full Cloudinary upload/delete flow |
| 07 | `07-implementation-roadmap.md` | Phase-by-phase build order mapped to concrete tables/files/endpoints, with what "done" means per phase |

## Non-negotiable architectural rule

> **The browser computes and renders. Supabase persists and broadcasts. FastAPI is a thin
> trust boundary that only handles operations where correctness cannot be left to the client.**

Everything else in this plan is a consequence of that one sentence.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14+ (App Router, TypeScript) | Server-rendered public pages for SEO/sharing, plus a full client app for dashboards |
| Frontend state | TanStack Query (server cache) + Zustand (local/UI state) | Avoids prop drilling, plays well with Supabase Realtime cache invalidation |
| Styling | Tailwind CSS + shadcn/ui | Fast to build a dense admin UI and a large-touch-target referee UI from the same primitives |
| Auth + DB + Realtime | Supabase (Postgres, Auth, Realtime, RLS) | One system for auth, persistence, and pub/sub — no custom WebSocket server to run on Render |
| Backend | FastAPI (Python 3.11+), deployed on Render | Thin trust layer: privileged writes, validation, moderation, schering/stat recompute triggers |
| Media | **Cloudinary** (images + video) | Replaces Supabase Storage everywhere in the original brief — see doc 06 |
| Offline (referee) | IndexedDB (via `idb`) + a sync queue | Referee phones on bad venue Wi-Fi must keep working |
| PWA | `next-pwa` / manual service worker | "Add to Home Screen" for referees and captains |

## Repo layout

```text
football-platform/
├── apps/
│   ├── web/                 # Next.js app — see doc 04
│   └── api/                 # FastAPI service — see doc 03
├── supabase/
│   ├── migrations/          # one timestamped .sql file per schema change — see doc 02
│   ├── functions/           # Postgres functions/triggers (recompute score, standings, stats)
│   └── seed.sql
├── packages/
│   └── shared-types/        # enums + TS types generated from the schema, imported by web
├── docs/                    # this plan lives here
└── .github/workflows/       # lint, typecheck, migration lint, deploy web + api
```

## The four engines

```text
IDENTITY ENGINE        COMPETITION ENGINE       MATCH ENGINE           STATISTICS ENGINE
auth, profiles,        events, event config,    referee/scorer,        raw stats, MVP,
friends, DMs,          registration, teams,     match clock, match     leaderboards, fair
notifications          rosters, scheduling,     events (event-        play, awards,
                        standings, brackets      sourced), disputes    career records
```

Every table in doc 02, every router in doc 03, and every route group in doc 04 is filed under
one of these four engines (plus a thin "Platform Admin" layer that cuts across all of them).

### Local Setup Instructions

1. **Install tools:**
   - Node.js (v20+) and `pnpm`
   - Python 3.11+ and `uv`
   - Supabase CLI

2. **Initialize services:**
   - `pnpm install` in the root (if using pnpm workspace)
   - `cd apps/api && uv sync`
   - Link to your Supabase project: `supabase link --project-ref your-ref`
   - Push migrations: `supabase db push`

3. **Environment variables:**
   - Copy `.env.example` to `.env` in the root.
   - Fill in Supabase and Cloudinary keys.

4. **Run development servers:**
   - FastAPI: `cd apps/api && uv run uvicorn app.main:app --reload`
   - Next.js: `cd apps/web && pnpm dev`
