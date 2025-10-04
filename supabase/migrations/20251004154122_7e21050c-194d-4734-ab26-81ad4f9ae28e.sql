-- Fix recursive policy on profiles by using security definer function
DROP POLICY IF EXISTS "Admins can manage their organization profiles" ON public.profiles;

CREATE POLICY "Admins can manage their organization profiles"
ON public.profiles
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_admin_active(auth.uid())
  AND admin_id = get_profile_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_admin_active(auth.uid())
  AND admin_id = get_profile_id(auth.uid())
);