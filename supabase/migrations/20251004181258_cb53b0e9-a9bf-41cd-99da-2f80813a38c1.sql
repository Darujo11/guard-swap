-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can manage all settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Admins can manage their own settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Guards can view their organization settings" ON public.organization_settings;

-- Drop table if exists
DROP TABLE IF EXISTS public.organization_settings;

-- Create organization settings table
CREATE TABLE public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  guard_label text NOT NULL DEFAULT 'Segurança',
  guards_label text NOT NULL DEFAULT 'Seguranças',
  team_label text NOT NULL DEFAULT 'Equipe',
  teams_label text NOT NULL DEFAULT 'Equipes',
  shift_label text NOT NULL DEFAULT 'Plantão',
  shifts_label text NOT NULL DEFAULT 'Plantões',
  schedule_label text NOT NULL DEFAULT 'Escala',
  schedules_label text NOT NULL DEFAULT 'Escalas',
  swap_label text NOT NULL DEFAULT 'Troca',
  swaps_label text NOT NULL DEFAULT 'Trocas',
  extra_label text NOT NULL DEFAULT 'Extra',
  extras_label text NOT NULL DEFAULT 'Extras',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(admin_id)
);

-- Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all settings
CREATE POLICY "Super admins can manage all settings"
ON public.organization_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Admins can manage their own settings
CREATE POLICY "Admins can manage their own settings"
ON public.organization_settings
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Guards can view their organization settings
CREATE POLICY "Guards can view their organization settings"
ON public.organization_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'guard'::app_role)
  AND admin_id IN (SELECT admin_id FROM profiles WHERE user_id = auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();