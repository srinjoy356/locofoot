from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.schemas.reports import ReportCreate, ReportUpdate
from app.services.report_service import ReportService

router = APIRouter(prefix="/api/v1/events", tags=["reports"])

@router.post("/{event_id}/reports")
async def create_report(event_id: str, data: ReportCreate, current_user: dict = Depends(get_current_user)):
    return ReportService.create_report(event_id, data, current_user['id'])

@router.patch("/{event_id}/reports/{report_id}")
async def update_report(event_id: str, report_id: str, data: ReportUpdate, current_user: dict = Depends(get_current_user)):
    return ReportService.update_report(event_id, report_id, data, current_user['id'])
