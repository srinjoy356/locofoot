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

email = "ref_93aa48ad-dda2-4161-9a23-403e350fdc3b@test.com"
res = httpx.get(f"{url}/rest/v1/users?email=eq.{email}&select=id", headers={"apikey": key, "Authorization": f"Bearer {key}"})
user_id = res.json()[0]['id']

# check notifications
notifs = httpx.get(f"{url}/rest/v1/notifications?user_id=eq.{user_id}&select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"}).json()
print("NOTIFICATIONS:")
print(notifs)

# check match_referees
refs = httpx.get(f"{url}/rest/v1/match_referees?user_id=eq.{user_id}&select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"}).json()
print("MATCH REFEREES:")
print(refs)

