-- Allow guards to view teams
CREATE POLICY "Guards can view teams"
ON teams
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'guard'::app_role));