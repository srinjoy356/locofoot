from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, media

app = FastAPI(title="Football Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(media.router)

from app.routers import events, venues, scheduling, match_engine, statistics, disputes, reports, announcements
app.include_router(events.router)
app.include_router(venues.router)
app.include_router(scheduling.router)
app.include_router(match_engine.router)
app.include_router(statistics.router)
app.include_router(disputes.router)
app.include_router(reports.router)
app.include_router(announcements.router)

import postgrest
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(postgrest.exceptions.APIError)
async def postgrest_api_error_handler(request: Request, exc: postgrest.exceptions.APIError):
    # exc.json() usually contains message, code, details, hint
    err_dict = exc.json()
    msg = err_dict.get('message', 'Database Error')
    if err_dict.get('details'):
        msg += f" - {err_dict['details']}"
    return JSONResponse(
        status_code=400,
        content={"detail": msg}
    )
