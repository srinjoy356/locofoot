# Phase 5C: Advanced Tournament Analytics Implementation Plan

This plan details the implementation of the Phase 5C requirements, focusing on Clutch, Comebacks, Records, and Trends. We strictly adhere to the architecture: PostgreSQL aggregation → thin FastAPI → Next.js presentation. 

## 1. Database Layer (PostgreSQL Views)

We will create a new migration `0056_phase5c_advanced_analytics.sql` containing the following views:

### `match_goal_chronology_view`
A foundational CTE/view that sequences goals from `match_timeline_events` (`event_type = 'SHOT'`, `result = 'GOAL'`) using window functions to calculate running scores (`home_score_at_time`, `away_score_at_time`).

### `tournament_clutch_player_stats_view`
Identifies and aggregates clutch goals per player in a tournament:
- **Equalizers**: Goals where the score becomes tied.
- **Game-Winning Goals (GWG)**: For a winning team, the specific goal that brings their score to `opponent_final_score + 1`. (e.g. if ending 3-1, it's the winner's 2nd goal).
- **Late Goals**: Goals scored after 80% of the match duration (or hardcoded > 80 mins if duration isn't strictly enforced, though we'll use elapsed_seconds > 80*60 as a default late game marker, assuming 90min match, or checking period = 'SECOND_HALF' and late elapsed).

### `tournament_comeback_team_stats_view`
Analyzes team comebacks:
- Joins match results with `match_goal_chronology_view`.
- **Fell Behind**: At any point, `team_score < opponent_score`.
- **Comeback Win**: Fell behind + Won match.
- **Comeback Draw**: Fell behind + Drew match.

### `tournament_records_view`
Calculates tournament extremes:
- Highest scoring match
- Biggest winning margin
- Highest scoring draw
- Team most goals in match
- Longest winning streak / unbeaten run (using `ROW_NUMBER` gaps-and-islands over team matches).

### `tournament_trends_view`
Aggregates goals and discipline by time buckets (e.g. First Half, Second Half, 0-15m, 76-90m) and by Matchday (using `schedule_slots` or chronological order).

## 2. API Layer (FastAPI)

Add the following thin endpoints to `apps/api/app/routers/statistics.py`:
- `GET /advanced/clutch/{event_id}`: Returns player clutch stats (GWG, Equalizers, Late).
- `GET /advanced/comebacks/{event_id}`: Returns team comeback metrics.
- `GET /advanced/records/{event_id}`: Returns the calculated records.
- `GET /advanced/trends/{event_id}`: Returns lightweight time-series data for trend charts (goals by half, discipline per match, etc).

## 3. Frontend Layer (Next.js)

Create `apps/web/src/app/(main)/events/[slug]/stats/advanced/page.tsx` that will act as the hub for Phase 5C analytics, featuring:
1. **Clutch Performers**: Leaderboards for GWG and Equalizers.
2. **Comeback Kings**: Table of teams with most comeback wins and draws.
3. **Tournament Records**: A grid highlighting biggest wins, highest scoring matches, and streak records.
4. **Trends**: Lightweight CSS-based or Recharts-based bar/line charts showing goals by half/segment and goals per matchday.

Update the horizontal navigation in `/events/[slug]/stats/page.tsx` (and other sibling stat pages) to include the "Advanced" tab.

## Open Questions
> [!IMPORTANT]  
> 1. For "Late Goals", should we assume standard 90-minute matches (late = 80+ mins) or 60-minute matches? I will default to goals in the last 10% of standard configured time, or safely rely on `elapsed_seconds >= 80 * 60` for typical football, unless there's a specific `match_settings` duration we should join against.
> 2. For "Matchday", Locofoot uses `schedule_slots`. Is grouping by the DATE of the `start_time` sufficient for a "Matchday" trend, or should we just order matches chronologically? I will default to grouping by date as a proxy for Matchday.

Please review this plan and let me know if it aligns with your expectations, or if you'd like any adjustments to the GWG/Comeback logic!
