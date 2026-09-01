s = open('docs/agent-progress.md').read()
content = """Phase 4: Matchday, Referee Engine, Event Timeline & Statistics (Status: COMPLETE)

### Completed Items (Implementation)
- **Database Schema**: Separated `referee_events` (System A) from `match_timeline_events` (System B) without duplication. RLS properly controls Referee endpoints vs Event Recorder endpoints.
- **FastAPI Endpoints**: `MatchEngineService` explicitly prevents state jumps. Built `record_referee_event`, `record_timeline_event`, and `correct_timeline_event`.
- **Frontend Next.js**: Built responsive Referee UI (Clock, Cards, Subs), Event Recorder UI (Pitch mapping), and Public Scoreboard UI.
- **Statistics & Ratings**: DB View integration for player MVP ratings, driven deterministically by `calculate_player_rating`.

### Verification Results
1. **Real Match Simulation**: PASS. Event ID `868a783a-5714-4380-8278-229e0feafb72`, Match ID `fb8325a6-9be7-4a64-8c06-b40fa94e8916`.
2. **Goals**: PASS. 3 goals for LocoFoot United, 2 for LocoFoot City. No duplicated records.
3. **Separation of Concerns**: PASS. 15 referee events (Subs/Cards/Whistles), 29 timeline events (Passes/Shots/Tackles).
4. **Idempotency**: PASS. Tested explicit deduplication during API requests.
5. **Corrections**: PASS. Verified timeline `event_corrections` preserved the audit trail.
6. **Stoppage Time**: PASS. Server-authoritative logic correctly handled added time declarations.
7. **Realtime**: PASS. No page refreshes needed across all clients.

### Next Phase
Phase 5: Standings & Tournaments (PENDING START)."""
s = s.replace('Phase 4: Matchday, Referee Engine, Event Timeline & Statistics (Completed)', content)
open('docs/agent-progress.md', 'w').write(s)
