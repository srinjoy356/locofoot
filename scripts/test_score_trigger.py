import psycopg2
import uuid

def main():
    db_url = 'postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # 1. Find a match
    cur.execute("SELECT id, home_registration_id, away_registration_id FROM public.matches LIMIT 1")
    match_id, home_reg_id, away_reg_id = cur.fetchone()
    
    print(f"Testing with match {match_id}")

    # Ensure match has no goals
    cur.execute("DELETE FROM match_timeline_events WHERE match_id = %s", (match_id,))
    cur.execute("UPDATE matches SET home_score = 0, away_score = 0 WHERE id = %s", (match_id,))
    conn.commit()

    # TEST 1: 0-0
    cur.execute("SELECT home_score, away_score FROM matches WHERE id = %s", (match_id,))
    h, a = cur.fetchone()
    print(f"Test 1 (0-0): {h}-{a}")

    # TEST 2: Home goal
    event1_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO match_timeline_events (id, match_id, event_type, period, elapsed_seconds, display_minute, display_second, actor_registration_id, metadata)
        VALUES (%s, %s, 'SHOT', 'FIRST_HALF', 60, 1, 0, %s, '{"result": "GOAL"}')
    """, (event1_id, match_id, home_reg_id))
    
    cur.execute("SELECT home_score, away_score FROM matches WHERE id = %s", (match_id,))
    h, a = cur.fetchone()
    print(f"Test 2 (Home Goal): {h}-{a}")

    # TEST 3: Away goal
    event2_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO match_timeline_events (id, match_id, event_type, period, elapsed_seconds, display_minute, display_second, actor_registration_id, metadata)
        VALUES (%s, %s, 'SHOT', 'FIRST_HALF', 120, 2, 0, %s, '{"result": "GOAL"}')
    """, (event2_id, match_id, away_reg_id))
    
    cur.execute("SELECT home_score, away_score FROM matches WHERE id = %s", (match_id,))
    h, a = cur.fetchone()
    print(f"Test 3 (Away Goal): {h}-{a}")

    # TEST 4: Multiple goals (Add another home goal)
    event3_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO match_timeline_events (id, match_id, event_type, period, elapsed_seconds, display_minute, display_second, actor_registration_id, metadata)
        VALUES (%s, %s, 'SHOT', 'FIRST_HALF', 180, 3, 0, %s, '{"result": "GOAL"}')
    """, (event3_id, match_id, home_reg_id))
    
    cur.execute("SELECT home_score, away_score FROM matches WHERE id = %s", (match_id,))
    h, a = cur.fetchone()
    print(f"Test 4 (Multiple Goals, should be 2-1): {h}-{a}")

    # TEST 5: Non-goal -> goal (Change a saved shot to goal)
    event4_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO match_timeline_events (id, match_id, event_type, period, elapsed_seconds, display_minute, display_second, actor_registration_id, metadata)
        VALUES (%s, %s, 'SHOT', 'FIRST_HALF', 240, 4, 0, %s, '{"result": "SAVED"}')
    """, (event4_id, match_id, home_reg_id))
    
    cur.execute("""
        UPDATE match_timeline_events SET metadata = '{"result": "GOAL"}' WHERE id = %s
    """, (event4_id,))
    
    cur.execute("SELECT home_score, away_score FROM matches WHERE id = %s", (match_id,))
    h, a = cur.fetchone()
    print(f"Test 5 (Non-goal -> Goal, should be 3-1): {h}-{a}")

    # TEST 6: Goal -> non-goal (Change the home goal to saved)
    cur.execute("""
        UPDATE match_timeline_events SET metadata = '{"result": "SAVED"}' WHERE id = %s
    """, (event4_id,))
    
    cur.execute("SELECT home_score, away_score FROM matches WHERE id = %s", (match_id,))
    h, a = cur.fetchone()
    print(f"Test 6 (Goal -> Non-goal, should be 2-1): {h}-{a}")

    # TEST 7: Delete goal
    cur.execute("DELETE FROM match_timeline_events WHERE id = %s", (event3_id,))
    
    cur.execute("SELECT home_score, away_score FROM matches WHERE id = %s", (match_id,))
    h, a = cur.fetchone()
    print(f"Test 7 (Delete Goal, should be 1-1): {h}-{a}")

    # TEST 8: Team correction
    cur.execute("""
        UPDATE match_timeline_events SET actor_registration_id = %s WHERE id = %s
    """, (away_reg_id, event1_id))
    
    cur.execute("SELECT home_score, away_score FROM matches WHERE id = %s", (match_id,))
    h, a = cur.fetchone()
    print(f"Test 8 (Team Correction, should be 0-2): {h}-{a}")

    # Rollback to clean up
    conn.rollback()
    print("Tests finished, changes rolled back.")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
