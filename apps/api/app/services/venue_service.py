from fastapi import HTTPException
from app.core.supabase_client import supabase_admin
from app.schemas.venues import VenueCreate, VenueUpdate, VenueFieldCreate, VenueFieldUpdate

class VenueService:
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
            pass

    @staticmethod
    def create_venue(data: VenueCreate, user_id: str):
        payload = data.model_dump(exclude_unset=True)
        payload["created_by"] = user_id
        res = supabase_admin.table('venues').insert(payload).execute()
        VenueService._log_audit(user_id, "CREATE_VENUE", "venues", res.data[0]['id'], None, res.data[0])
        return res.data[0]

    @staticmethod
    def update_venue(venue_id: str, data: VenueUpdate, user_id: str):
        current = supabase_admin.table('venues').select('*').eq('id', venue_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Venue not found")
        if current.data['created_by'] != user_id:
            # Maybe allow platform admins? For now, just creator
            raise HTTPException(403, "Not authorized to update this venue")
            
        updates = data.model_dump(exclude_unset=True)
        if not updates:
            return current.data
            
        res = supabase_admin.table('venues').update(updates).eq('id', venue_id).execute()
        VenueService._log_audit(user_id, "UPDATE_VENUE", "venues", venue_id, current.data, res.data[0])
        return res.data[0]

    @staticmethod
    def create_field(venue_id: str, data: VenueFieldCreate, user_id: str):
        venue = supabase_admin.table('venues').select('*').eq('id', venue_id).single().execute()
        if not venue.data or venue.data['created_by'] != user_id:
            raise HTTPException(403, "Not authorized to add fields to this venue")
            
        payload = data.model_dump(exclude_unset=True)
        payload["venue_id"] = venue_id
        res = supabase_admin.table('venue_fields').insert(payload).execute()
        VenueService._log_audit(user_id, "CREATE_VENUE_FIELD", "venue_fields", res.data[0]['id'], None, res.data[0])
        return res.data[0]

    @staticmethod
    def update_field(venue_id: str, field_id: str, data: VenueFieldUpdate, user_id: str):
        venue = supabase_admin.table('venues').select('*').eq('id', venue_id).single().execute()
        if not venue.data or venue.data['created_by'] != user_id:
            raise HTTPException(403, "Not authorized to update fields in this venue")
            
        current = supabase_admin.table('venue_fields').select('*').eq('id', field_id).eq('venue_id', venue_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Field not found")
            
        updates = data.model_dump(exclude_unset=True)
        if not updates:
            return current.data
            
        res = supabase_admin.table('venue_fields').update(updates).eq('id', field_id).execute()
        VenueService._log_audit(user_id, "UPDATE_VENUE_FIELD", "venue_fields", field_id, current.data, res.data[0])
        return res.data[0]

    @staticmethod
    def delete_field(venue_id: str, field_id: str, user_id: str):
        venue = supabase_admin.table('venues').select('*').eq('id', venue_id).single().execute()
        if not venue.data or venue.data['created_by'] != user_id:
            raise HTTPException(403, "Not authorized to delete fields in this venue")
            
        current = supabase_admin.table('venue_fields').select('*').eq('id', field_id).eq('venue_id', venue_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Field not found")
            
        supabase_admin.table('venue_fields').delete().eq('id', field_id).execute()
        VenueService._log_audit(user_id, "DELETE_VENUE_FIELD", "venue_fields", field_id, current.data, None)
        return {"status": "deleted"}
