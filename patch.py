import os
import requests

url = "https://lcxgjwdffkexrrnfcuik.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM"

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

res = requests.patch(
    f"{url}/rest/v1/event_settings?event_id=eq.54fe84f0-6d89-4bf3-a7f3-75c9db1707bf",
    headers=headers,
    json={"first_half_minutes": 30, "second_half_minutes": 30}
)
print(res.json())
