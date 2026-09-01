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

email = "referee@gmail.com"
res = httpx.get(f"{url}/rest/v1/users?email=eq.{email}&select=id", headers={"apikey": key, "Authorization": f"Bearer {key}"})
user_id = res.json()[0]['id']

# create a dummy notification just so they see it
httpx.post(f"{url}/rest/v1/notifications", headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "return=minimal"}, json={
    "user_id": user_id,
    "type": "EVENT_REFEREE_ASSIGNED",
    "payload": {"event_id": "dummy"}
})
print("Sent dummy notification")
