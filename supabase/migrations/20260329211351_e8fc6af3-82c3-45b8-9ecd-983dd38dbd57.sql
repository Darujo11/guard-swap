CREATE POLICY "Guards can delete their own TRE leaves"
  ON public.leaves FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'guard'::app_role)
    AND guard_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND leave_type = 'TRE'
  );