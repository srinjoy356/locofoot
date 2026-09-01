import asyncio
import os
import sys

sys.path.append('C:\\dev\\locofoot\\apps\\api')
from supabase import create_client

url = "https://lcxgjwdffkexrrnfcuik.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM"

client = create_client(url, key)
try:
    res = client.table("match_lineups").select("*").limit(1).execute()
    print("Migration SUCCESS: match_lineups table exists.")
except Exception as e:
    print(f"Migration CHECK FAILED: {e}")
