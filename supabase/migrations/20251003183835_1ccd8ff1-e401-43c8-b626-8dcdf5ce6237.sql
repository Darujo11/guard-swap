-- Fix existing guard Pedro to allow login with phone
-- Update auth user email to match phone format and confirm email
UPDATE auth.users
SET email = '22999491428@guard.local',
    email_confirmed_at = NOW(),
    confirmation_token = NULL
WHERE id = '61ce7483-c2e7-4c4a-947e-3f99c272da7b';