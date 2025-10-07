-- Adicionar política para permitir que guardas vejam perfis de outros guardas na mesma organização
-- Isso é necessário para exibir informações do "membro convidado" nas solicitações de troca

CREATE POLICY "Guards can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'guard'::app_role) 
  AND admin_id IN (
    SELECT admin_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);