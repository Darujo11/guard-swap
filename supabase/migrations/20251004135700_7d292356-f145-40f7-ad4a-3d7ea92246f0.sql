-- 1. Criar tabela de planos
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_months INTEGER NOT NULL,
  max_guards INTEGER,
  max_teams INTEGER,
  features JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Criar tabela de assinaturas dos admins
CREATE TABLE IF NOT EXISTS public.admin_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active',
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Habilitar RLS nas novas tabelas
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas RLS para subscription_plans
CREATE POLICY "Super admins can manage all plans"
ON public.subscription_plans
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view active plans"
ON public.subscription_plans
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) AND active = true);

-- 5. Criar políticas RLS para admin_subscriptions
CREATE POLICY "Super admins can manage all subscriptions"
ON public.admin_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view their own subscription"
ON public.admin_subscriptions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND admin_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 6. Criar função para verificar se é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- 7. Atualizar políticas existentes
DROP POLICY IF EXISTS "Allow all team operations" ON public.teams;
CREATE POLICY "Super admins and admins can manage teams"
ON public.teams
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Allow all profile operations" ON public.profiles;
CREATE POLICY "Super admins can manage all profiles"
ON public.profiles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage their organization profiles"
ON public.profiles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow all swap request operations" ON public.swap_requests;
CREATE POLICY "Super admins and admins can manage swap requests"
ON public.swap_requests
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Allow all audit log operations" ON public.audit_logs;
CREATE POLICY "Super admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view organization audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. Inserir planos padrão
INSERT INTO public.subscription_plans (name, description, price, duration_months, max_guards, max_teams, features) VALUES
('Plano Mensal', 'Plano básico mensal com todas as funcionalidades', 99.90, 1, 50, 10, '["Gestão de escalas", "Trocas de plantão", "Relatórios básicos"]'::jsonb),
('Plano Trimestral', 'Plano trimestral com desconto de 10%', 269.70, 3, 100, 20, '["Gestão de escalas", "Trocas de plantão", "Relatórios avançados", "Suporte prioritário"]'::jsonb),
('Plano Anual', 'Plano anual com desconto de 20%', 959.04, 12, NULL, NULL, '["Gestão de escalas", "Trocas de plantão", "Relatórios avançados", "Suporte prioritário", "Guardas ilimitados", "Equipes ilimitadas"]'::jsonb);

-- 9. Criar triggers para atualizar updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_subscriptions_updated_at
BEFORE UPDATE ON public.admin_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();