-- Remove foreign key constraint to allow sample data without auth users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Make user_id nullable for sample data
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to work without authentication for development
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can manage teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can create swap requests" ON public.swap_requests;
DROP POLICY IF EXISTS "Users can update swap requests involving them" ON public.swap_requests;
DROP POLICY IF EXISTS "Users can view swap requests involving them" ON public.swap_requests;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teams are viewable by authenticated users" ON public.teams;
DROP POLICY IF EXISTS "Users can create audit logs" ON public.audit_logs;

-- Create permissive policies for development (allow all operations without authentication)
CREATE POLICY "Allow all profile operations" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all team operations" ON public.teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all audit log operations" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all swap request operations" ON public.swap_requests FOR ALL USING (true) WITH CHECK (true);