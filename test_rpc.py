import os
import httpx

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

res = httpx.post(f"{url}/rest/v1/rpc/invite_match_referee", headers={"apikey": key, "Authorization": f"Bearer {key}"}, json={"p_match_id": "00000000-0000-0000-0000-000000000000", "p_unique_code": "FTB-I4R25P"})
print(res.status_code)
print(res.text)
