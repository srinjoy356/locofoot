# Engineering Rules

1. The docs/ directory is the source of truth.
2. Implement one roadmap phase at a time.
3. Never implement future phases unless explicitly instructed.
4. Never replace Supabase Realtime with custom WebSockets.
5. Never put heavy computation on FastAPI/Render when browser computation is sufficient.
6. Never expose service-role credentials to the client.
7. Never disable RLS for convenience.
8. Never create fake/mock APIs unless the task explicitly requests them.
9. Never mutate append-only match_events.
10. Corrections create superseding events.
11. Every trusted mutation follows:
    state guard → permission guard → cross-entity guard → idempotent write → audit log.
12. Every database migration must include RLS.
13. Every derived statistic must be recomputable.
14. Every phase must pass tests before the next phase begins.
15. After completing a requested phase, STOP and report.