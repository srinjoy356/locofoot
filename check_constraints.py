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

sql = """
SELECT
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
WHERE tc.table_name IN ('match_referees', 'event_roles')
ORDER BY tc.table_name, tc.constraint_name;
"""

res = httpx.post(
    f"{url}/rest/v1/rpc/exec_sql", 
    headers={"apikey": key, "Authorization": f"Bearer {key}"},
    json={"query": sql}
)
if res.status_code == 404:
    print("NO exec_sql RPC")
else:
    print(res.json())
