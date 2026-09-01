import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def run_fix():
    print("Connecting...")
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            print("Fetching all matches...")
            cur.execute("SELECT id FROM public.matches;")
            matches = cur.fetchall()
            for match in matches:
                match_id = match[0]
                print(f"Computing ratings for match {match_id}...")
                cur.execute("SELECT public.compute_match_ratings_and_mvp(%s);", (match_id,))
            conn.commit()
            print("Done!")

if __name__ == "__main__":
    run_fix()
