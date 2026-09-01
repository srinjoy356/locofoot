import re

file_path = 'apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

func_old = """      const [matchesRes, slotsRes, assignmentsRes, fieldsRes, eventRes] = await Promise.all([
        supabase.from('matches').select('*, home_team:event_team_registrations!home_registration_id(team_name, team_short_name), away_team:event_team_registrations!away_registration_id(team_name, team_short_name)').eq('event_id', eventId).eq('scheduling_status', 'UNASSIGNED'),
        supabase.from('schedule_slots').select('*').eq('event_id', eventId).order('sequence_number', { ascending: true }),
        supabase.from('slot_field_assignments').select('*, schedule_slots!inner(event_id)').eq('schedule_slots.event_id', eventId),
        supabase.from('venue_fields').select('*'), // Should filter by venue_id ideally
        supabase.from('events').select('*').eq('id', eventId).single()
      ]);
      
      setUnassignedFixtures(matchesRes.data || []);
      setSlots(slotsRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setFields(fieldsRes.data || []);
      setEvent(eventRes.data);
    } catch (err: any) {"""
func_new = """      const [matchesRes, slotsRes, assignmentsRes, fieldsRes, eventRes] = await Promise.all([
        supabase.from('matches').select('*, home_team:event_team_registrations!home_registration_id(team_name, team_short_name), away_team:event_team_registrations!away_registration_id(team_name, team_short_name)').eq('event_id', eventId).eq('scheduling_status', 'UNASSIGNED'),
        supabase.from('schedule_slots').select('*').eq('event_id', eventId).order('sequence_number', { ascending: true }),
        supabase.from('slot_field_assignments').select('*, schedule_slots!inner(event_id)').eq('schedule_slots.event_id', eventId),
        supabase.from('venue_fields').select('*'), // Should filter by venue_id ideally
        supabase.from('events').select('*').eq('id', eventId).single()
      ]);
      
      setUnassignedFixtures(matchesRes.data || []);
      setSlots(slotsRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setFields(fieldsRes.data || []);
      setEvent(eventRes.data);

      // Load Match Referees manually since match_referees points to auth.users not public.users
      const { data: allMatches } = await supabase.from('matches').select('id').eq('event_id', eventId);
      if (allMatches && allMatches.length > 0) {
        const matchIds = allMatches.map(m => m.id);
        const { data: mRefs } = await supabase.from('match_referees').select('*').in('match_id', matchIds);
        
        if (mRefs && mRefs.length > 0) {
          const userIds = [...new Set(mRefs.map(mr => mr.user_id))];
          const { data: users } = await supabase.from('users').select('*').in('id', userIds);
          
          const refsMap: Record<string, any[]> = {};
          mRefs.forEach(mr => {
            if (!refsMap[mr.match_id]) refsMap[mr.match_id] = [];
            mr.user = users?.find(u => u.id === mr.user_id);
            refsMap[mr.match_id].push(mr);
          });
          setMatchReferees(refsMap);
        } else {
          setMatchReferees({});
        }
      }
    } catch (err: any) {"""
content = content.replace(func_old, func_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
