import asyncio
from uuid import uuid4, UUID
from app.services.scheduling_service import scheduling_service
from app.schemas.scheduling import ScheduleNextRequest

async def run_test():
    event_id = UUID('54fe84f0-6d89-4bf3-a7f3-75c9db1707bf')
    actor_id = UUID('b459779d-92c2-449e-9c81-d8633c55b701')
    payload = ScheduleNextRequest(idempotency_key=uuid4())
    try:
        result = await scheduling_service.generate_next_slot(event_id, payload, actor_id)
        print('SUCCESS! Output:')
        print(result)
    except Exception as e:
        print('ERROR:')
        print(str(e))

asyncio.run(run_test())