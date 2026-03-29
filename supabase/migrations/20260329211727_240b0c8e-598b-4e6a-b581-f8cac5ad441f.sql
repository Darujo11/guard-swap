CREATE POLICY "Guards can insert their own TRE leaves"
  ON public.leaves FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'guard'::app_role)
    AND guard_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND leave_type = 'TRE'
  );