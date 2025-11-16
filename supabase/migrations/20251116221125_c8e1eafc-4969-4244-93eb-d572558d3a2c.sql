-- Corrigir RLS policies da tabela audit_logs
-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Users can create their own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;

-- Permitir que usuários autenticados inserem seus próprios logs
CREATE POLICY "Users can create their own audit logs"
ON audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Permitir que service role (edge functions) insira logs
CREATE POLICY "Service role can insert audit logs"
ON audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);