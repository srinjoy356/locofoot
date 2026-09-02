import os
import psycopg2
from collections import defaultdict

def main():
    db_url = 'postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Get all matches and their current stored scores
    cur.execute("SELECT id, home_score, away_score, home_registration_id, away_registration_id FROM public.matches")
    matches = cur.fetchall()
    
    # Get all goals from timeline
    cur.execute("""
        SELECT match_id, actor_registration_id 
        FROM public.match_timeline_events 
        WHERE event_type = 'SHOT' AND metadata->>'result' = 'GOAL'
    """)
    goals = cur.fetchall()
    
    # Compute derived scores
    derived_scores = defaultdict(lambda: {'home': 0, 'away': 0})
    
    # Build match dict to map reg IDs
    match_dict = {}
    for m in matches:
        match_id, h_score, a_score, h_reg_id, a_reg_id = m
        match_dict[match_id] = {
            'home_reg': h_reg_id,
            'away_reg': a_reg_id,
            'stored_home': h_score,
            'stored_away': a_score
        }
        
    for match_id, actor_reg_id in goals:
        if match_id in match_dict:
            if actor_reg_id == match_dict[match_id]['home_reg']:
                derived_scores[match_id]['home'] += 1
            elif actor_reg_id == match_dict[match_id]['away_reg']:
                derived_scores[match_id]['away'] += 1
                
    # Check for inconsistencies
    total_matches = len(matches)
    inconsistent_matches = []
    
    for m in matches:
        match_id, stored_home, stored_away, _, _ = m
        derived_home = derived_scores[match_id]['home']
        derived_away = derived_scores[match_id]['away']
        
        if stored_home != derived_home or stored_away != derived_away:
            inconsistent_matches.append(match_id)
            print(f"Mismatch in {match_id}: Stored {stored_home}-{stored_away}, Derived {derived_home}-{derived_away}")
            
    print(f"Total Matches: {total_matches}")
    print(f"Inconsistent before: {len(inconsistent_matches)}")
    
    # Fix inconsistencies by invoking the function
    for match_id in inconsistent_matches:
        cur.execute("SELECT public.recalculate_match_score(%s)", (match_id,))
    
    conn.commit()
    print(f"Matches repaired: {len(inconsistent_matches)}")
    
    # Verification pass
    cur.execute("SELECT id, home_score, away_score FROM public.matches")
    matches_after = cur.fetchall()
    
    inconsistent_after = 0
    for m in matches_after:
        match_id, stored_home, stored_away = m
        derived_home = derived_scores[match_id]['home']
        derived_away = derived_scores[match_id]['away']
        if stored_home != derived_home or stored_away != derived_away:
            inconsistent_after += 1
            
    print(f"Inconsistent after: {inconsistent_after}")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
