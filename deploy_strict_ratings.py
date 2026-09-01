import psycopg2
DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def run_fix():
    print("Connecting...")
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            with open(r"C:\dev\locofoot\supabase\migrations\0052_phase5_strict_ratings.sql", "r") as f:
                sql = f.read()
            cur.execute(sql)
            conn.commit()
            print("Deployed!")

if __name__ == "__main__":
    run_fix()
