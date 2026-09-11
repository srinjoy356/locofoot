import os
import asyncio
from supabase import create_async_client, AsyncClient
from dotenv import load_dotenv

load_dotenv()

async def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    # print(f"URL: {url}")
    
    db: AsyncClient = await create_async_client(url, key)
    
    # We don't have a valid JWT here, but let's see what error it raises for an invalid one.
    try:
        res = await db.auth.get_user("fake.jwt.token")
        print("Result:", res)
    except Exception as e:
        print("Auth Exception:", e)

asyncio.run(main())
