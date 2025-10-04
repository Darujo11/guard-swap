-- Add admin_id to tables for data isolation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.swap_requests ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.extras ADD COLUMN IF NOT EXISTS admin_id uuid;
ALTER TABLE public.team_schedules ADD COLUMN IF NOT EXISTS admin_id uuid;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_admin_id ON public.profiles(admin_id);
CREATE INDEX IF NOT EXISTS idx_teams_admin_id ON public.teams(admin_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_admin_id ON public.swap_requests(admin_id);
CREATE INDEX IF NOT EXISTS idx_extras_admin_id ON public.extras(admin_id);
CREATE INDEX IF NOT EXISTS idx_team_schedules_admin_id ON public.team_schedules(admin_id);

-- Update RLS policies for profiles
DROP POLICY IF EXISTS "Admins can manage their organization profiles" ON public.profiles;
CREATE POLICY "Admins can manage their organization profiles"
ON public.profiles
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Update RLS policies for teams
DROP POLICY IF EXISTS "Super admins and admins can manage teams" ON public.teams;
CREATE POLICY "Super admins can manage all teams"
ON public.teams
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage their organization teams"
ON public.teams
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Update RLS policies for swap_requests
DROP POLICY IF EXISTS "Super admins and admins can manage swap requests" ON public.swap_requests;
CREATE POLICY "Super admins can manage all swap requests"
ON public.swap_requests
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage their organization swap requests"
ON public.swap_requests
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Update RLS policies for extras
DROP POLICY IF EXISTS "Admins can manage all extras" ON public.extras;
CREATE POLICY "Super admins can manage all extras"
ON public.extras
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage their organization extras"
ON public.extras
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Update RLS policies for team_schedules
DROP POLICY IF EXISTS "Admins can manage all schedules" ON public.team_schedules;
CREATE POLICY "Super admins can manage all schedules"
ON public.team_schedules
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage their organization schedules"
ON public.team_schedules
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);