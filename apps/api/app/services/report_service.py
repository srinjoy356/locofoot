from fastapi import HTTPException
from app.core.supabase_client import supabase_admin
from app.schemas.reports import ReportCreate, ReportUpdate
from app.services.event_service import EventService

class ReportService:
    @staticmethod
    def create_report(event_id: str, data: ReportCreate, user_id: str):
        res = supabase_admin.table('reports').insert({
            "target_type": data.target_type,
            "target_id": str(data.target_id),
            "reason": data.reason,
            "description": data.description,
            "reporter_id": user_id,
            "status": "OPEN"
        }).execute()
        
        if not res.data:
            raise HTTPException(500, "Failed to create report")
            
        report = res.data[0]
        EventService._log_audit(user_id, "CREATE_REPORT", "reports", report['id'], None, report)
        return report

    @staticmethod
    def update_report(event_id: str, report_id: str, data: ReportUpdate, user_id: str):
        EventService._require_admin(event_id, user_id)
        
        current = supabase_admin.table('reports').select('*').eq('id', report_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Report not found")
            
        old_status = current.data['status']
        new_status = data.status
        
        updates = {
            "status": new_status,
            "resolution_notes": data.resolution_notes
        }
        if new_status in ['ACTIONED', 'DISMISSED'] and old_status not in ['ACTIONED', 'DISMISSED']:
            updates['resolved_by'] = user_id
            updates['resolved_at'] = 'now()'
            
        res = supabase_admin.table('reports').update(updates).eq('id', report_id).execute()
        EventService._log_audit(user_id, "UPDATE_REPORT", "reports", report_id, current.data, res.data[0])
        return res.data[0]
