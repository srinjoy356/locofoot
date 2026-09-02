import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
import json

load_dotenv('apps/api/.env')
db_url = os.getenv('DATABASE_URL')
if not db_url:
    load_dotenv('.env')
    db_url = os.getenv('SUPABASE_DB_URL')

conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("--- 4. DATABASE SCORE CONSISTENCY ---")
cur.execute('''
    WITH derived AS (
        SELECT 
            m.id as match_id,
            m.home_score as stored_home,
            m.away_score as stored_away,
            COUNT(CASE WHEN e.team_id = m.home_registration_id THEN 1 END) as derived_home,
            COUNT(CASE WHEN e.team_id = m.away_registration_id THEN 1 END) as derived_away
        FROM matches m
        LEFT JOIN match_timeline_events e ON e.match_id = m.id AND e.event_type = 'SHOT' AND (e.metadata->>'result') = 'GOAL' AND e.metadata->>'deleted' IS NULL
        GROUP BY m.id, m.home_score, m.away_score, m.home_registration_id, m.away_registration_id
    )
    SELECT 
        match_id, derived_home, stored_home, derived_away, stored_away,
        (derived_home = COALESCE(stored_home, 0) AND derived_away = COALESCE(stored_away, 0)) as is_consistent
    FROM derived
''')
res = cur.fetchall()
total = len(res)
consistent = sum(1 for r in res if r['is_consistent'])
inconsistent = total - consistent

print(f'Total matches: {total}')
print(f'Consistent: {consistent}')
print(f'Inconsistent: {inconsistent}')
print(f'Consistency %: { (consistent/total*100) if total > 0 else 100:.2f}%')

if inconsistent > 0:
    for r in res:
        if not r['is_consistent']:
            print(f"Inconsistent match: {r['match_id']} - Derived: {r['derived_home']}-{r['derived_away']}, Stored: {r['stored_home']}-{r['stored_away']}")

print("\\n--- 5. SCORE FUNCTION SECURITY ---")
cur.execute('''
    SELECT p.proname, p.prosecdef, pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    WHERE p.proname = 'recalculate_match_score'
''')
func = cur.fetchone()
if func:
    print(f'Function SECDEF: {func["prosecdef"]}')
    print(f'Function def:\\n{func["def"]}')
else:
    print("Function 'recalculate_match_score' not found.")

print("\\n--- 6. TRIGGER ---")
cur.execute('''
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_name = 'on_timeline_event_score_trigger'
''')
triggers = cur.fetchall()
for t in triggers:
    print(f"{t['event_manipulation']} - {t['action_statement']}")

print("\\n--- 7 & 8 & 21. SHOT & GOAL DEFINITION IN VIEWS ---")
cur.execute('''
    SELECT viewname, definition 
    FROM pg_views 
    WHERE viewname = 'match_statistics_overview_view'
''')
view = cur.fetchone()
if view:
    print(f"View match_statistics_overview_view exists. Extracting shot logic...")
    for line in view['definition'].split('\\n'):
        if 'SHOT' in line or 'GOAL' in line or 'assist' in line.lower():
            print(line.strip())
