from fastapi import HTTPException
from app.core.supabase_client import supabase_admin
from app.schemas.events import EventCreate, EventUpdate, EventSettingsUpdate, EventStatusUpdate, EventRoleCreate
import uuid

class EventService:
    @staticmethod
    def _require_admin(event_id: str, user_id: str):
        res = supabase_admin.table('event_roles').select('*').eq('event_id', event_id).eq('user_id', user_id).in_('role', ['EVENT_OWNER', 'EVENT_ADMIN']).execute()
        if not res.data:
            raise HTTPException(status_code=403, detail="Not authorized. Must be EVENT_OWNER or EVENT_ADMIN.")

    @staticmethod
    def _require_owner(event_id: str, user_id: str):
        res = supabase_admin.table('event_roles').select('*').eq('event_id', event_id).eq('user_id', user_id).eq('role', 'EVENT_OWNER').execute()
        if not res.data:
            raise HTTPException(status_code=403, detail="Not authorized. Must be EVENT_OWNER.")

    @staticmethod
    def _log_audit(actor_id: str, action: str, entity_type: str, entity_id: str, old_value: dict, new_value: dict):
        try:
            supabase_admin.table('audit_logs').insert({
                "actor_id": actor_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old_value": old_value,
                "new_value": new_value
            }).execute()
        except Exception:
            pass # Non-blocking audit log

    @staticmethod
    def create_event(data: EventCreate, user_id: str):
        # 1. Create event
        event_res = supabase_admin.table('events').insert({
            "name": data.name,
            "description": data.description,
            "organizer_id": user_id,
            "status": "DRAFT",
            "public_token": str(uuid.uuid4())
        }).execute()
        
        if not event_res.data:
            raise HTTPException(status_code=500, detail="Failed to create event")
            
        event_id = event_res.data[0]['id']
        
        # 2. Create defaults
        supabase_admin.table('event_settings').insert({"event_id": event_id}).execute()
        supabase_admin.table('event_disciplinary_rules').insert({"event_id": event_id}).execute()
        
        # Default stats
        default_stats = [
            {"event_id": event_id, "stat_key": "GOAL", "label": "Goal", "category": "OFFENSIVE", "points_value": 5},
            {"event_id": event_id, "stat_key": "ASSIST", "label": "Assist", "category": "OFFENSIVE", "points_value": 3},
            {"event_id": event_id, "stat_key": "YELLOW_CARD", "label": "Yellow Card", "category": "DISCIPLINE", "points_value": -2},
            {"event_id": event_id, "stat_key": "RED_CARD", "label": "Red Card", "category": "DISCIPLINE", "points_value": -5}
        ]
        supabase_admin.table('event_stat_definitions').insert(default_stats).execute()
        
        # 3. Create role
        supabase_admin.table('event_roles').insert({
            "event_id": event_id,
            "user_id": user_id,
            "role": "EVENT_OWNER",
            "granted_by": user_id
        }).execute()

        EventService._log_audit(user_id, "CREATE_EVENT", "events", event_id, None, event_res.data[0])
        
        return event_res.data[0]

    @staticmethod
    def update_event(event_id: str, data: EventUpdate, user_id: str):
        EventService._require_admin(event_id, user_id)
        
        current = supabase_admin.table('events').select('*').eq('id', event_id).single().execute()
        
        updates = data.model_dump(exclude_unset=True, mode='json')
        if not updates:
            return current.data
            
        res = supabase_admin.table('events').update(updates).eq('id', event_id).execute()
        EventService._log_audit(user_id, "UPDATE_EVENT", "events", event_id, current.data, res.data[0])
        return res.data[0]

    @staticmethod
    def update_settings(event_id: str, data: EventSettingsUpdate, user_id: str):
        EventService._require_admin(event_id, user_id)
        
        updates = data.model_dump(exclude_unset=True, mode='json')
        if not updates:
            return {"status": "no_changes"}
            
        # Validation checks
        if 'min_squad' in updates and 'max_squad' in updates:
            if updates['min_squad'] > updates['max_squad']:
                raise HTTPException(400, "min_squad cannot be greater than max_squad")
                
        current = supabase_admin.table('event_settings').select('*').eq('event_id', event_id).single().execute()
        res = supabase_admin.table('event_settings').update(updates).eq('event_id', event_id).execute()
        EventService._log_audit(user_id, "UPDATE_EVENT_SETTINGS", "event_settings", event_id, current.data, res.data[0])
        return res.data[0]

    @staticmethod
    def update_status(event_id: str, data: EventStatusUpdate, user_id: str):
        EventService._require_admin(event_id, user_id)
        
        current = supabase_admin.table('events').select('*').eq('id', event_id).single().execute()
        old_status = current.data['status']
        new_status = data.status.value
        
        if old_status == new_status:
            return current.data
            
        # Transitions mapping
        allowed = {
            'DRAFT': ['REGISTRATION_OPEN', 'CANCELLED'],
            'REGISTRATION_OPEN': ['REGISTRATION_CLOSED', 'CANCELLED'],
            'REGISTRATION_CLOSED': ['SCHEDULING', 'SCHEDULED', 'LIVE', 'REGISTRATION_OPEN', 'CANCELLED'],
            'SCHEDULING': ['SCHEDULED', 'LIVE', 'REGISTRATION_CLOSED', 'CANCELLED'],
            'SCHEDULED': ['LIVE', 'SCHEDULING', 'CANCELLED'],
            'LIVE': ['COMPLETED', 'CANCELLED'],
            'COMPLETED': ['ARCHIVED'],
            'CANCELLED': [],
            'ARCHIVED': []
        }
        
        if new_status not in allowed.get(old_status, []):
            raise HTTPException(400, f"Cannot transition from {old_status} to {new_status}")
            
        res = supabase_admin.table('events').update({'status': new_status}).eq('id', event_id).execute()
        EventService._log_audit(user_id, "UPDATE_EVENT_STATUS", "events", event_id, {"status": old_status}, {"status": new_status})
        return res.data[0]

    @staticmethod
    def assign_role(event_id: str, data: EventRoleCreate, user_id: str):
        EventService._require_owner(event_id, user_id)
        
        res = supabase_admin.table('event_roles').insert({
            "event_id": event_id,
            "user_id": data.user_id,
            "role": data.role.value,
            "granted_by": user_id
        }).execute()
        EventService._log_audit(user_id, "ASSIGN_EVENT_ROLE", "event_roles", res.data[0]['id'], None, res.data[0])
        return res.data[0]

    @staticmethod
    def revoke_role(event_id: str, role_id: str, user_id: str):
        EventService._require_owner(event_id, user_id)
        current = supabase_admin.table('event_roles').select('*').eq('id', role_id).eq('event_id', event_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Role not found")
            
        if current.data['role'] == 'EVENT_OWNER' and current.data['user_id'] == user_id:
            raise HTTPException(400, "Cannot revoke own owner role")
            
        supabase_admin.table('event_roles').delete().eq('id', role_id).execute()
        EventService._log_audit(user_id, "REVOKE_EVENT_ROLE", "event_roles", role_id, current.data, None)
        return {"status": "deleted"}
