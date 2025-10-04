-- Create helper function to fetch current user's profile id (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_profile_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Fix recursive RLS on profiles by using the helper function
DROP POLICY IF EXISTS "Admins can manage their organization profiles" ON public.profiles;
CREATE POLICY "Admins can manage their organization profiles"
ON public.profiles
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id = public.get_profile_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id = public.get_profile_id(auth.uid())
);