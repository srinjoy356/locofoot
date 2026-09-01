import urllib.request
import json

url = "http://127.0.0.1:8000/api/v1/statistics/standings/54fe84f0-6d89-4bf3-a7f3-75c9db1707bf"
req = urllib.request.urlopen(url)
data = json.loads(req.read())
print([t['matches_played'] for t in data])
