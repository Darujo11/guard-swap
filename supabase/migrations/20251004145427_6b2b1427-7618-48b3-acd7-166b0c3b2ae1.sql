-- Add is_active column to profiles to track suspended accounts
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create function to check and update admin status based on subscription
CREATE OR REPLACE FUNCTION public.check_admin_subscription_status(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
  _has_valid_subscription boolean;
BEGIN
  -- Get profile id
  SELECT id INTO _profile_id
  FROM profiles
  WHERE user_id = _user_id;
  
  IF _profile_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if admin has active subscription that hasn't expired
  SELECT EXISTS (
    SELECT 1
    FROM admin_subscriptions
    WHERE admin_id = _profile_id
      AND status = 'active'
      AND end_date > NOW()
      AND payment_status = 'paid'
  ) INTO _has_valid_subscription;
  
  -- Update profile is_active based on subscription status
  -- Only for admin users
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id AND role = 'admin'
  ) THEN
    UPDATE profiles
    SET is_active = _has_valid_subscription
    WHERE id = _profile_id;
  END IF;
  
  RETURN _has_valid_subscription;
END;
$$;

-- Create function to automatically suspend admins with expired subscriptions
CREATE OR REPLACE FUNCTION public.suspend_expired_admins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Suspend admins whose subscriptions have expired
  UPDATE profiles p
  SET is_active = false
  FROM user_roles ur
  LEFT JOIN admin_subscriptions asub ON asub.admin_id = p.id
  WHERE p.user_id = ur.user_id
    AND ur.role = 'admin'
    AND (
      asub.id IS NULL 
      OR asub.end_date < NOW() 
      OR asub.status != 'active'
      OR asub.payment_status != 'paid'
    )
    AND p.is_active = true;
    
  -- Activate admins with valid subscriptions
  UPDATE profiles p
  SET is_active = true
  FROM user_roles ur
  INNER JOIN admin_subscriptions asub ON asub.admin_id = p.id
  WHERE p.user_id = ur.user_id
    AND ur.role = 'admin'
    AND asub.end_date > NOW()
    AND asub.status = 'active'
    AND asub.payment_status = 'paid'
    AND p.is_active = false;
END;
$$;