import httpx; print(httpx.put('http://127.0.0.1:8000/api/v1/events/e580d21c-52f0-43d2-a140-6c602afce51f/settings', json={'players_on_field': 11}).text)  
