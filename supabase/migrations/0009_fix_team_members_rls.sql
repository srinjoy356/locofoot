DROP POLICY "users can accept/decline own invites, captains can remove" ON public.team_members;

CREATE POLICY "users can accept/decline own invites, captains can remove" ON public.team_members FOR UPDATE USING (
  -- The user can update their own row (restricted by WITH CHECK)
  user_id = auth.uid()
  OR
  -- Captain can update any row
  EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role = 'CAPTAIN' AND tm.status = 'ACCEPTED'
  )
) WITH CHECK (
  -- If user is updating their own row, they can only change status
  (
    user_id = auth.uid() 
    AND team_id = (SELECT tm2.team_id FROM public.team_members tm2 WHERE tm2.id = team_members.id)
    AND role = (SELECT tm2.role FROM public.team_members tm2 WHERE tm2.id = team_members.id)
    AND user_id = (SELECT tm2.user_id FROM public.team_members tm2 WHERE tm2.id = team_members.id)
    AND invited_by IS NOT DISTINCT FROM (SELECT tm2.invited_by FROM public.team_members tm2 WHERE tm2.id = team_members.id)
    AND status IN ('ACCEPTED', 'DECLINED', 'LEFT')
  )
  OR
  -- Captain can remove
  (
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role = 'CAPTAIN' AND tm.status = 'ACCEPTED'
    )
  )
);
