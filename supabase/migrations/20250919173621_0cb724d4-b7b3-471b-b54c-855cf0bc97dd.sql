-- Insert a sample admin user profile for testing
-- This assumes you have a user with this email in your auth.users table
-- You can replace this with your actual admin user email

-- First, let's create a helper function to get user by email
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_address text)
RETURNS uuid AS $$
DECLARE
    user_uuid uuid;
BEGIN
    SELECT id INTO user_uuid FROM auth.users WHERE email = email_address LIMIT 1;
    RETURN user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create sample teams
INSERT INTO public.teams (name, description) VALUES 
  ('Equipe Alpha', 'Equipe principal de segurança'),
  ('Equipe Beta', 'Equipe de apoio e reforço'),
  ('Equipe Gamma', 'Equipe especializada em eventos')
ON CONFLICT (name) DO NOTHING;

-- Create a sample admin profile (you'll need to replace 'admin@exemplo.com' with your actual admin email)
-- This will only work if you have a user with this email in auth.users
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Try to get the user ID for the admin email
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@exemplo.com' LIMIT 1;
    
    -- If we found a user, create their profile
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, name, email, role) 
        VALUES (admin_user_id, 'Admin Sistema', 'admin@exemplo.com', 'ADMIN')
        ON CONFLICT (user_id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            role = EXCLUDED.role;
    END IF;
END $$;