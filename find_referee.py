import os
import httpx
import json

# Read env manually
env_vars = {}
with open('.env', 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env_vars[k] = v

url = env_vars.get("SUPABASE_URL")
key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY")

res = httpx.get(f"{url}/rest/v1/users?select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"})
users = res.json()

# Find a referee user
ref = next((u for u in users if 'ref_' in (u.get('email') or '') or 'Referee' in (u.get('username') or '')), None)

if ref:
    print(f"EMAIL: {ref.get('email')}")
    print(f"PASSWORD: password123")
    print(f"UNIQUE_CODE: {ref.get('unique_code')}")
else:
    print("No referee found.")
