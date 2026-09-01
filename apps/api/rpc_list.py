import json  
data = json.load(open('openapi.json', encoding='utf-8'))  
for p in data.get('paths', {}):  
    if p.startswith('/rpc/'): print(p)  
