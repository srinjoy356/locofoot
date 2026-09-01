import urllib.request
import json

try:
    url = "http://127.0.0.1:8000/api/v1/statistics/tournament-players/54fe84f0-6d89-4bf3-a7f3-75c9db1707bf"
    req = urllib.request.urlopen(url)
    data = json.loads(req.read())
    
    with_goals = [p for p in data if p['goals'] > 0]
    with_matches = [p for p in data if p['matches_played'] > 0]
    
    print(f"Total players: {len(data)}")
    print(f"Players with goals: {len(with_goals)}")
    print(f"Players with matches: {len(with_matches)}")
except Exception as e:
    print(e)
