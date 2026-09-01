import asyncio
import os
import time
from supabase import create_async_client

async def main():
    env=dict([line.strip().split('=',1) for line in open('../../.env').readlines() if '=' in line and not line.startswith('#')])
    t0 = time.time()
    db = await create_async_client(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])
    print(f'Init: {time.time()-t0:.2f}s')
    t1 = time.time()
    res = await db.table('matches').select('id').limit(1).execute()
    print(f'Query: {time.time()-t1:.2f}s, res={res}')

asyncio.run(main())
