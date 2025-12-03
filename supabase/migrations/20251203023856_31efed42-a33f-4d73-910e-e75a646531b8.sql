-- Add RLS policy for guards to view all organization extras for transparency
CREATE POLICY "Guards can view organization extras for transparency"
ON extras
FOR SELECT
USING (
  has_role(auth.uid(), 'guard'::app_role) 
  AND admin_id IN (
    SELECT profiles.admin_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);