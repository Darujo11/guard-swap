-- Remover a política problemática que causa recursão infinita
DROP POLICY IF EXISTS "Guards can view profiles in their organization" ON public.profiles;

-- Criar uma função SECURITY DEFINER para obter o admin_id do usuário atual
-- Isso bypassa RLS e evita recursão
CREATE OR REPLACE FUNCTION public.get_user_admin_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Criar a política correta usando a função SECURITY DEFINER
CREATE POLICY "Guards can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'guard'::app_role) 
  AND admin_id = get_user_admin_id(auth.uid())
);