CREATE TABLE public.guard_tre_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES public.profiles(id),
  total_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guard_id)
);

ALTER TABLE public.guard_tre_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their org quotas"
  ON public.guard_tre_quotas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND admin_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can manage all quotas"
  ON public.guard_tre_quotas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Guards can view their own quota"
  ON public.guard_tre_quotas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'guard') AND guard_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));