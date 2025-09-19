-- Fix security warning for function search path
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_address text)
RETURNS uuid AS $$
DECLARE
    user_uuid uuid;
BEGIN
    SELECT id INTO user_uuid FROM auth.users WHERE email = email_address LIMIT 1;
    RETURN user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;