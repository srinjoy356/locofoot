import httpx
import os

env_vars = {}
with open('.env', 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env_vars[k] = v

url = env_vars.get("SUPABASE_URL")
key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY")

# Check event roles for 54fe84f0-6d89-4bf3-a7f3-75c9db1707bf
res = httpx.get(f"{url}/rest/v1/event_roles?event_id=eq.54fe84f0-6d89-4bf3-a7f3-75c9db1707bf&select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"}).json()
print("Roles for event:")
for r in res:
    print(r)

# Check user ID for FTB-BSCCG7
res = httpx.get(f"{url}/rest/v1/users?unique_code=eq.FTB-BSCCG7&select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"}).json()
print("\nUser for code:")
print(res)

