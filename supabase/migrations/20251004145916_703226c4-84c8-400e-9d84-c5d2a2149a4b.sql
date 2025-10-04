-- Drop the problematic policy
DROP POLICY IF EXISTS "Suspended admins cannot access data" ON public.profiles;

-- Create a helper function to check if admin is active
CREATE OR REPLACE FUNCTION public.is_admin_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_active, true)
  FROM profiles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Update existing admin policies to check is_active status
-- We need to recreate the "Admins can manage their organization profiles" policy
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