import os  
from supabase import create_client  
url = 'https://lcxgjwdffkexrrnfcuik.supabase.co'  
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  
import urllib.request, json  
req = urllib.request.Request(url + '/rest/v1/', headers={'apikey': key})  
print(urllib.request.urlopen(req).read().decode())  
