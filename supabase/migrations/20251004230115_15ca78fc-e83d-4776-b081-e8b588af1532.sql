-- ============================================================================
-- CRITICAL SECURITY FIX: Profiles Table RLS Policies
-- ============================================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;

-- Create a more restrictive profile creation policy
-- Users can only create their own profile during signup
CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow service role to manage profiles (for edge functions)
-- This is more explicit and documented than the previous "true" policy
CREATE POLICY "Service role can manage profiles for edge functions"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- CRITICAL SECURITY FIX: User Roles Privilege Escalation
-- ============================================================================

-- Drop the dangerous admin policy that allows privilege escalation
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Create a helper function to check if a user belongs to an admin's organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_admin_org(_admin_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if target user's admin_id matches the admin's profile id
  SELECT EXISTS (
    SELECT 1
    FROM profiles admin_profile
    JOIN profiles target_profile ON target_profile.admin_id = admin_profile.id
    WHERE admin_profile.user_id = _admin_user_id
      AND target_profile.user_id = _target_user_id
  )
$$;

-- New restricted policy for admins managing roles
-- Admins can only:
-- 1. Grant/revoke 'guard' role (not 'admin' or 'super_admin')
-- 2. Only for users in their organization
-- 3. Cannot modify their own roles
CREATE POLICY "Admins can manage guard roles in their organization"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_admin_active(auth.uid())
  AND role = 'guard'
  AND user_id != auth.uid()  -- Cannot modify own roles
  AND user_belongs_to_admin_org(auth.uid(), user_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND is_admin_active(auth.uid())
  AND role = 'guard'  -- Can only grant 'guard' role
  AND user_id != auth.uid()  -- Cannot modify own roles
  AND user_belongs_to_admin_org(auth.uid(), user_id)
);

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

-- Add trigger to log role changes
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'ROLE_GRANTED',
      'user_role',
      NEW.id,
      jsonb_build_object('target_user_id', NEW.user_id, 'role', NEW.role)
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'ROLE_REVOKED',
      'user_role',
      OLD.id,
      jsonb_build_object('target_user_id', OLD.user_id, 'role', OLD.role)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS user_roles_audit_trigger ON public.user_roles;
CREATE TRIGGER user_roles_audit_trigger
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_changes();