import urllib.request
import json

try:
    url = "http://127.0.0.1:8000/api/v1/statistics/tournament-players/54fe84f0-6d89-4bf3-a7f3-75c9db1707bf"
    req = urllib.request.urlopen(url)
    data = json.loads(req.read())
    print("Players fetched:", len(data))
    if len(data) > 0:
        print(json.dumps(data[0], indent=2))
except Exception as e:
    print(e)
