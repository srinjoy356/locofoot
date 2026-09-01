-- Remove the complex WITH CHECK and replace with a simpler one
DROP POLICY IF EXISTS "users can accept/decline own invites, captains can remove" ON public.team_members;

CREATE POLICY "users can accept/decline own invites, captains can remove" ON public.team_members FOR UPDATE USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role = 'CAPTAIN' AND tm.status = 'ACCEPTED'
  )
) WITH CHECK (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role = 'CAPTAIN' AND tm.status = 'ACCEPTED'
  )
);

-- Trigger to prevent column modifications by non-captains
CREATE OR REPLACE FUNCTION public.fn_team_members_protect_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id = auth.uid() THEN
    -- A user is updating their own row. Ensure they don't change core columns.
    IF NEW.team_id != OLD.team_id OR 
       NEW.user_id != OLD.user_id OR 
       NEW.role != OLD.role OR 
       NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
      RAISE EXCEPTION 'Users can only update their own status';
    END IF;
    IF NEW.status NOT IN ('ACCEPTED', 'DECLINED', 'LEFT') THEN
      RAISE EXCEPTION 'Invalid status update';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_team_members_protect_columns BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.fn_team_members_protect_columns();
