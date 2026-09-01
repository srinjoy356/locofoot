import os, urllib.request, json
url = 'https://api.supabase.com/v1/projects/lcxgjwdffkexrrnfcuik/query'
token = 'sbp_...'
with open(r'C:\dev\locofoot\supabase\migrations\0056_phase5c_advanced_analytics.sql', 'r') as f:
    sql = f.read()
try:
    req = urllib.request.Request(url, data=json.dumps({'query': sql}).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}, method='POST')
    res = urllib.request.urlopen(req)
    print("Success:", res.read().decode())
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
