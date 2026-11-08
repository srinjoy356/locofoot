from fastapi import HTTPException
from datetime import datetime
from app.core.supabase_client import supabase_admin
from app.schemas.registrations import (
    TeamRegistrationCreate, 
    TeamRegistrationStatusUpdate,
    EventTeamInvitationCreate,
    EventTeamInvitationStatusUpdate,
    EventRosterPlayerUpdate,
    GuestPlayerAdd,
    TeamSeedUpdate
)

class RegistrationService:
    @staticmethod
    def _log_audit(user_id: str, action: str, entity_type: str, entity_id: str, old_value: dict, new_value: dict):
        try:
            supabase_admin.table('audit_logs').insert({
                "actor_id": user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old_value": old_value,
                "new_value": new_value
            }).execute()
        except Exception:
            pass

    @staticmethod
    def _is_event_admin(event_id: str, user_id: str) -> bool:
        res = supabase_admin.table('event_roles').select('*').eq('event_id', event_id).eq('user_id', user_id).in_('role', ['EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER']).execute()
        return len(res.data) > 0

    @staticmethod
    def create_registration(event_id: str, data: TeamRegistrationCreate, user_id: str):
        event = supabase_admin.table('events').select('status').eq('id', event_id).single().execute()
        if not event.data or event.data['status'] not in ['REGISTRATION_OPEN', 'DRAFT']:
            raise HTTPException(400, "Registration is not open for this event.")
            
        res = supabase_admin.table('event_team_registrations').insert({
            "event_id": event_id,
            "team_name": data.team_name,
            "team_short_name": data.team_short_name,
            "logo_media_id": data.logo_media_id,
            "captain_id": user_id,
            "status": "DRAFT",
            "registered_at": datetime.utcnow().isoformat()
        }).execute()

        reg_id = res.data[0]['id']
        
        # Auto-add captain as the first player
        supabase_admin.table('event_team_players').insert({
            "event_registration_id": reg_id,
            "user_id": user_id,
            "status": "APPROVED",
            "is_captain_for_event": True
        }).execute()
        
        RegistrationService._log_audit(user_id, "CREATE_REGISTRATION", "event_team_registrations", reg_id, None, res.data[0])
        return res.data[0]

    @staticmethod
    def invite_player(event_id: str, reg_id: str, data: EventTeamInvitationCreate, user_id: str):
        reg = supabase_admin.table('event_team_registrations').select('*').eq('id', reg_id).eq('event_id', event_id).single().execute()
        if not reg.data or reg.data['captain_id'] != user_id:
            raise HTTPException(403, "Only the team captain can invite players.")

        if reg.data.get('roster_locked'):
            raise HTTPException(400, "Cannot invite players because the team roster is locked by the organizer.")

        if reg.data['status'] != 'DRAFT':
            raise HTTPException(400, "Cannot invite players outside of DRAFT status.")

        if data.invited_user_id == user_id:
            raise HTTPException(400, "Cannot invite yourself.")

        # Check friendship
        friend = supabase_admin.table('friendships').select('*').eq('status', 'ACCEPTED').or_(
            f"and(requester_id.eq.{user_id},addressee_id.eq.{data.invited_user_id}),and(requester_id.eq.{data.invited_user_id},addressee_id.eq.{user_id})"
        ).execute()
        if not friend.data:
            raise HTTPException(403, "Can only invite friends.")

        # Check if an invitation already exists for this registration and user
        existing = supabase_admin.table('event_team_invitations').select('id, status').eq('registration_id', reg_id).eq('invited_user_id', data.invited_user_id).execute()
        
        if existing.data and existing.data[0]['status'] == 'PENDING':
            raise HTTPException(400, "This user already has a pending invitation.")

        try:
            if existing.data:
                # Update the existing invitation to PENDING
                res = supabase_admin.table('event_team_invitations').update({
                    "status": "PENDING",
                    "invited_by": user_id,
                    "responded_at": None
                }).eq('id', existing.data[0]['id']).execute()
            else:
                # Insert new invitation
                res = supabase_admin.table('event_team_invitations').insert({
                    "registration_id": reg_id,
                    "invited_user_id": data.invited_user_id,
                    "invited_by": user_id,
                    "status": "PENDING"
                }).execute()
        except Exception as e:
            raise HTTPException(400, f"Failed to send invitation: {str(e)}")

        RegistrationService._log_audit(user_id, "CREATE_INVITATION", "event_team_invitations", res.data[0]['id'], None, res.data[0])
        return res.data[0]

    @staticmethod
    def update_invitation_status(event_id: str, reg_id: str, inv_id: str, data: EventTeamInvitationStatusUpdate, user_id: str):
        # Enforce roster lock
        reg = supabase_admin.table('event_team_registrations').select('roster_locked').eq('id', reg_id).single().execute()
        if reg.data and reg.data.get('roster_locked'):
            raise HTTPException(400, "Cannot change invitation status because the team roster is locked by the organizer.")

        if data.status.value == "ACCEPTED":
            # Delegate to the trusted Postgres RPC for atomic checks and inserts
            try:
                res = supabase_admin.rpc("accept_event_team_invitation", {
                    "p_invitation_id": inv_id,
                    "p_user_id": user_id
                }).execute()
                if not res.data:
                    raise HTTPException(400, "Failed to accept invitation.")
                return {"status": "ACCEPTED", "player_id": res.data}
            except HTTPException:
                raise
            except Exception as e:
                # PostgREST errors carry a readable .message; str(e) would be a raw dict
                raise HTTPException(400, getattr(e, "message", None) or str(e))
            
        elif data.status.value in ["DECLINED", "CANCELLED"]:
            # Standard decline/cancel logic
            inv = supabase_admin.table('event_team_invitations').select('*').eq('id', inv_id).single().execute()
            if not inv.data:
                raise HTTPException(404, "Invitation not found")
            
            # If declined, user must be the invited user
            if data.status.value == "DECLINED" and inv.data['invited_user_id'] != user_id:
                raise HTTPException(403, "Not authorized to decline")
            
            # If cancelled, user must be the captain
            if data.status.value == "CANCELLED":
                reg = supabase_admin.table('event_team_registrations').select('captain_id').eq('id', reg_id).single().execute()
                if not reg.data or reg.data['captain_id'] != user_id:
                    raise HTTPException(403, "Not authorized to cancel")

            res = supabase_admin.table('event_team_invitations').update({
                "status": data.status.value,
                "responded_at": datetime.utcnow().isoformat()
            }).eq('id', inv_id).execute()
            
            return res.data[0]

    @staticmethod
    def submit_registration(event_id: str, reg_id: str, user_id: str):
        reg = supabase_admin.table('event_team_registrations').select('*').eq('id', reg_id).eq('event_id', event_id).single().execute()
        if not reg.data or reg.data['captain_id'] != user_id:
            raise HTTPException(403, "Only the team captain can submit the registration.")

        if reg.data['status'] != 'DRAFT':
            raise HTTPException(400, "Registration is not in DRAFT status.")

        # Check squad size
        roster = supabase_admin.table('event_team_players').select('*', count='exact').eq('event_registration_id', reg_id).execute()
        settings = supabase_admin.table('event_settings').select('min_squad').eq('event_id', event_id).single().execute()
        
        if roster.count < settings.data['min_squad']:
            raise HTTPException(400, f"Minimum squad size is {settings.data['min_squad']}, but only {roster.count} {'player is' if roster.count == 1 else 'players are'} in the squad.")

        res = supabase_admin.table('event_team_registrations').update({"status": "PENDING_APPROVAL"}).eq('id', reg_id).execute()
        RegistrationService._log_audit(user_id, "SUBMIT_REGISTRATION", "event_team_registrations", reg_id, reg.data, res.data[0])
        return res.data[0]

    @staticmethod
    def update_registration_status(event_id: str, reg_id: str, data: TeamRegistrationStatusUpdate, user_id: str):
        if not RegistrationService._is_event_admin(event_id, user_id):
            raise HTTPException(403, "Not authorized.")

        current = supabase_admin.table('event_team_registrations').select('*').eq('id', reg_id).eq('event_id', event_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Registration not found.")

        updates = {"status": data.status.value}
        if data.status.value == "APPROVED":
            updates["approved_at"] = datetime.utcnow().isoformat()
            updates["approved_by"] = user_id

        res = supabase_admin.table('event_team_registrations').update(updates).eq('id', reg_id).execute()
        
        if data.status.value == "APPROVED" and current.data['status'] != "APPROVED":
            supabase_admin.table('notifications').insert({
                "user_id": current.data['captain_id'],
                "type": "TEAM_REGISTRATION_APPROVED",
                "payload": {"event_id": event_id, "registration_id": reg_id}
            }).execute()

        RegistrationService._log_audit(user_id, "UPDATE_REGISTRATION_STATUS", "event_team_registrations", reg_id, current.data, res.data[0])
        return res.data[0]

    @staticmethod
    def set_seed(event_id: str, reg_id: str, data: TeamSeedUpdate, user_id: str):
        if not RegistrationService._is_event_admin(event_id, user_id):
            raise HTTPException(403, "Not authorized.")
        current = supabase_admin.table('event_team_registrations').select('*').eq('id', reg_id).eq('event_id', event_id).execute().data
        if not current:
            raise HTTPException(404, "Registration not found.")
        if data.seed is not None:
            clash = supabase_admin.table('event_team_registrations').select('team_name').eq('event_id', event_id).eq('seed', data.seed).neq('id', reg_id).execute().data
            if clash:
                raise HTTPException(409, f"Seed {data.seed} already belongs to {clash[0]['team_name']}.")
        res = supabase_admin.table('event_team_registrations').update({"seed": data.seed}).eq('id', reg_id).execute()
        RegistrationService._log_audit(user_id, "SET_SEED", "event_team_registrations", reg_id, {"seed": current[0].get('seed')}, {"seed": data.seed})
        return res.data[0]

    @staticmethod
    def lock_roster(event_id: str, reg_id: str, user_id: str):
        if not RegistrationService._is_event_admin(event_id, user_id):
            raise HTTPException(403, "Not authorized.")

        current = supabase_admin.table('event_team_registrations').select('*').eq('id', reg_id).eq('event_id', event_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Registration not found.")

        res = supabase_admin.table('event_team_registrations').update({"roster_locked": True}).eq('id', reg_id).execute()
        
        supabase_admin.table('notifications').insert({
            "user_id": current.data['captain_id'],
            "type": "TEAM_ROSTER_LOCKED",
            "payload": {"event_id": event_id, "registration_id": reg_id}
        }).execute()

        RegistrationService._log_audit(user_id, "LOCK_ROSTER", "event_team_registrations", reg_id, current.data, res.data[0])
        return res.data[0]

    @staticmethod
    def unlock_roster(event_id: str, reg_id: str, user_id: str):
        if not RegistrationService._is_event_admin(event_id, user_id):
            raise HTTPException(403, "Not authorized.")

        current = supabase_admin.table('event_team_registrations').select('*').eq('id', reg_id).eq('event_id', event_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Registration not found.")

        res = supabase_admin.table('event_team_registrations').update({"roster_locked": False}).eq('id', reg_id).execute()
        
        RegistrationService._log_audit(user_id, "UNLOCK_ROSTER", "event_team_registrations", reg_id, current.data, res.data[0])
        return res.data[0]

    @staticmethod
    def get_squad(event_id: str, reg_id: str, user_id: str):
        # We fetch the squad using service role to bypass RLS for the users table
        # This is needed because users are hidden from non-friends, but team members need to see each other
        if not supabase_admin.table('event_team_registrations').select('id').eq('id', reg_id).eq('event_id', event_id).execute().data:
            raise HTTPException(404, "Registration not found in this event.")
        res = supabase_admin.table('event_team_players').select('*, users(id, display_name, username, unique_code)').eq('event_registration_id', reg_id).execute()
        return res.data

    @staticmethod
    def _can_manage_registration(event_id: str, reg_id: str, user_id: str) -> bool:
        """Event admins, the registering captain, or the event captain / vice-captain of the team."""
        if RegistrationService._is_event_admin(event_id, user_id):
            return True
        reg = supabase_admin.table('event_team_registrations').select('captain_id').eq('id', reg_id).eq('event_id', event_id).execute().data
        if not reg:
            return False
        if reg[0].get('captain_id') == user_id:
            return True
        lead = supabase_admin.table('event_team_players').select('id').eq('event_registration_id', reg_id).eq('user_id', user_id)             .or_('is_captain_for_event.eq.true,is_vice_captain_for_event.eq.true').execute().data
        return bool(lead)

    @staticmethod
    def get_invitations(event_id: str, reg_id: str, user_id: str):
        if not RegistrationService._can_manage_registration(event_id, reg_id, user_id):
            raise HTTPException(403, "Not authorized to view invitations.")
        res = supabase_admin.table('event_team_invitations').select('*').eq('registration_id', reg_id).eq('status', 'PENDING').execute()
        return res.data

    @staticmethod
    def get_registrations(event_id: str, user_id: str):
        if not RegistrationService._is_event_admin(event_id, user_id):
            raise HTTPException(403, "Not authorized to view registrations.")
            
        res = supabase_admin.table('event_team_registrations').select('*, players:event_team_players(*, user:users(id, display_name, username, email, unique_code))').eq('event_id', event_id).order('registered_at').execute()
        return res.data

    @staticmethod
    def _draft_registration_for_captain(event_id: str, reg_id: str, user_id: str) -> dict:
        reg = supabase_admin.table('event_team_registrations').select('*').eq('id', reg_id).eq('event_id', event_id).execute().data
        if not reg:
            raise HTTPException(404, "Registration not found.")
        if reg[0]['captain_id'] != user_id:
            raise HTTPException(403, "Only the team captain can change the squad.")
        if reg[0].get('roster_locked'):
            raise HTTPException(400, "The team roster is locked by the organizer.")
        if reg[0]['status'] != 'DRAFT':
            raise HTTPException(400, "The squad can only be changed while the registration is in DRAFT.")
        return reg[0]

    @staticmethod
    def add_guest_player(event_id: str, reg_id: str, data: GuestPlayerAdd, user_id: str):
        """A player who has no account (most grassroots squads have some). They are listed by name and can be fielded and scored like anyone else."""
        RegistrationService._draft_registration_for_captain(event_id, reg_id, user_id)
        name = data.guest_name.strip()
        if not name:
            raise HTTPException(400, "Player name is required.")
        settings = supabase_admin.table('event_settings').select('max_squad, allow_duplicate_jersey_numbers').eq('event_id', event_id).single().execute().data
        squad = supabase_admin.table('event_team_players').select('id, jersey_number, guest_name').eq('event_registration_id', reg_id).in_('status', ['PENDING_APPROVAL', 'APPROVED']).execute().data
        if settings.get('max_squad') and len(squad) >= settings['max_squad']:
            raise HTTPException(400, f"Maximum squad size of {settings['max_squad']} reached.")
        if data.jersey_number is not None and not settings.get('allow_duplicate_jersey_numbers') and any(p['jersey_number'] == data.jersey_number for p in squad):
            raise HTTPException(400, f"Jersey number {data.jersey_number} is already taken in this squad.")
        if any((p.get('guest_name') or '').lower() == name.lower() for p in squad):
            raise HTTPException(400, f"{name} is already in the squad.")
        res = supabase_admin.table('event_team_players').insert({
            "event_registration_id": reg_id, "guest_name": name, "jersey_number": data.jersey_number,
            "position": data.position, "status": "APPROVED",
        }).execute()
        RegistrationService._log_audit(user_id, "ADD_GUEST_PLAYER", "event_team_players", res.data[0]['id'], None, res.data[0])
        return res.data[0]

    @staticmethod
    def remove_guest_player(event_id: str, reg_id: str, player_id: str, user_id: str):
        RegistrationService._draft_registration_for_captain(event_id, reg_id, user_id)
        row = supabase_admin.table('event_team_players').select('*').eq('id', player_id).eq('event_registration_id', reg_id).execute().data
        if not row or row[0].get('user_id'):
            raise HTTPException(404, "Guest player not found in this squad.")
        supabase_admin.table('event_team_players').delete().eq('id', player_id).execute()
        RegistrationService._log_audit(user_id, "REMOVE_GUEST_PLAYER", "event_team_players", player_id, row[0], None)
        return {"status": "success"}

    @staticmethod
    def remove_player(event_id: str, reg_id: str, player_user_id: str, current_user_id: str):
        reg = supabase_admin.table('event_team_registrations').select('*').eq('id', reg_id).eq('event_id', event_id).single().execute()
        if not reg.data:
            raise HTTPException(404, "Registration not found.")
            
        if reg.data['captain_id'] != current_user_id:
            raise HTTPException(403, "Only the team captain can remove players.")

        if reg.data.get('roster_locked'):
            raise HTTPException(400, "Cannot remove players because the team roster is locked by the organizer.")

        if reg.data['status'] != 'DRAFT':
            raise HTTPException(400, "Cannot remove players outside of DRAFT status.")
            
        if reg.data['captain_id'] == player_user_id:
            raise HTTPException(400, "The captain cannot be removed from the team.")

        res = supabase_admin.table('event_team_players').delete().eq('event_registration_id', reg_id).eq('user_id', player_user_id).execute()
        
        # Also cancel any pending invitations for this user
        supabase_admin.table('event_team_invitations').update({"status": "CANCELLED"}).eq('registration_id', reg_id).eq('invited_user_id', player_user_id).eq('status', 'PENDING').execute()
        
        RegistrationService._log_audit(current_user_id, "REMOVE_PLAYER", "event_team_players", reg_id, {"removed_user_id": player_user_id}, None)
        return {"status": "success"}
