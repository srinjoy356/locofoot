import os
import psycopg2
from dotenv import load_dotenv

# Try to find the .env file in the root directory
load_dotenv('../../.env.local')
load_dotenv('../../.env')

# Check if we have standard SUPABASE_DB_URL or DATABASE_URL
db_url = os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_DB_URL')
if not db_url:
    print("Database URL not found.")
    
    # Alternatively, try using the httpx method if Supabase RPC is enabled, or wait, standard Supabase doesn't have run_sql
    import httpx
    url = f"{os.environ['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/rpc/run_sql"
    headers = {
        'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
        'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
        'Content-Type': 'application/json'
    }
    with open(r'C:\dev\locofoot\supabase\migrations\0056_phase5c_advanced_analytics.sql', 'r') as f:
        query = f.read()
    res = httpx.post(url, headers=headers, json={'query': query})
    print("RPC result:", res.status_code, res.text)
else:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    with open(r'C:\dev\locofoot\supabase\migrations\0056_phase5c_advanced_analytics.sql', 'r') as f:
        cur.execute(f.read())
    conn.commit()
    print('Success via psycopg2')
