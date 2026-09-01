import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def run_fix():
    print("Connecting...")
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            print("Reading SQL...")
            with open(r"C:\dev\locofoot\supabase\migrations\0050_phase5_advanced_ratings.sql", "r") as f:
                sql = f.read()
            print("Executing SQL...")
            cur.execute(sql)
            conn.commit()
            print("Done!")

if __name__ == "__main__":
    run_fix()
