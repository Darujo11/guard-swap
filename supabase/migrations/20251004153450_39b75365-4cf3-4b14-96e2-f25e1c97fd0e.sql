-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage their organization profiles" ON public.profiles;

-- Create a new policy that doesn't cause recursion
-- This policy allows admins to manage profiles where the admin_id matches their own profile id
CREATE POLICY "Admins can manage their organization profiles" 
ON public.profiles 
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_admin_active(auth.uid())
  AND admin_id IN (
    SELECT p.id 
    FROM public.profiles p
    INNER JOIN auth.users u ON u.id = p.user_id
    WHERE u.id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND is_admin_active(auth.uid())
  AND admin_id IN (
    SELECT p.id 
    FROM public.profiles p
    INNER JOIN auth.users u ON u.id = p.user_id
    WHERE u.id = auth.uid()
  )
);

-- Also ensure the Service role policy exists and is correct
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
CREATE POLICY "Service role can manage all profiles"
ON public.profiles
FOR ALL
USING (true)
WITH CHECK (true);