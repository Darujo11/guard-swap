-- Adicionar política para permitir service role criar perfis
-- Isso é necessário para edge functions que usam service role
CREATE POLICY "Service role can manage all profiles"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Também precisamos garantir que perfis possam ser inseridos durante signup
CREATE POLICY "Allow profile creation during signup"
ON public.profiles
FOR INSERT
WITH CHECK (true);