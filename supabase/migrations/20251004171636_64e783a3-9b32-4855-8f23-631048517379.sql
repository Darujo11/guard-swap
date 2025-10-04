-- Criar política para permitir que guardas criem solicitações de troca
CREATE POLICY "Guards can create their own swap requests"
ON swap_requests
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'guard'::app_role) 
  AND requester_id IN (
    SELECT id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
  AND admin_id IN (
    SELECT admin_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Criar política para permitir que guardas visualizem suas próprias solicitações
CREATE POLICY "Guards can view their own swap requests"
ON swap_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'guard'::app_role) 
  AND (
    requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR target_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Criar política para permitir que guardas atualizem solicitações onde são o alvo
CREATE POLICY "Guards can update swap requests where they are target"
ON swap_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'guard'::app_role) 
  AND target_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'guard'::app_role) 
  AND target_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);