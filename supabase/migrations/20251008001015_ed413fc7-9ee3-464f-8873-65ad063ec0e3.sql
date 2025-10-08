-- Permitir que seguranças possam excluir suas próprias solicitações de troca
CREATE POLICY "Guards can delete their own swap requests"
ON swap_requests
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'guard'::app_role) 
  AND requester_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);