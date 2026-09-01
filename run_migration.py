import os
import json
import urllib.request
import urllib.error

# Basic dot env parser since we don't have dotenv
env_vars = {}
with open('.env', 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env_vars[k] = v

TOKEN = env_vars.get('SUPABASE_ACCESS_TOKEN')
PROJECT_REF = 'lcxgjwdffkexrrnfcuik'

sql = open('supabase/migrations/0029_phase6_referee_management.sql').read()

req = urllib.request.Request(
    f'https://api.supabase.com/v1/projects/{PROJECT_REF}/query',
    data=json.dumps({'query': sql}).encode('utf-8'),
    headers={
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    },
    method='POST'
)

try:
    with urllib.request.urlopen(req) as response:
        print(response.status)
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(e.status)
    print(e.read().decode('utf-8'))
