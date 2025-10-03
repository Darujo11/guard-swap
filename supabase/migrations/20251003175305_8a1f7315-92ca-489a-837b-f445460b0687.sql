-- Create admin user
-- Note: This creates a profile for an admin, but the admin must be created in Supabase Auth first

-- Insert admin profile (if user already exists)
-- The admin should have email: admin@guardshift.com and password: admin123456

DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Try to get admin user from auth.users
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@guardshift.com';
  
  -- Only create profile if admin user exists and profile doesn't exist
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, name, email)
    VALUES (admin_user_id, 'Administrador', 'admin@guardshift.com')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;