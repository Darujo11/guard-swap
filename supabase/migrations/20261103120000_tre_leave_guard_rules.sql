-- Afastamentos TRE: o segurança só mexe no que ainda está pendente.
-- Antes: podia apagar TRE já aprovado (inclusive de data passada) e recuperar o dia,
-- e podia inserir um pedido já com status APPROVED direto pela API.

DROP POLICY IF EXISTS "Guards can delete their own TRE leaves" ON public.leaves;
CREATE POLICY "Guards can delete their own TRE leaves"
  ON public.leaves FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'guard'::app_role)
    AND guard_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND leave_type = 'TRE'
    AND status = 'PENDING'
  );

DROP POLICY IF EXISTS "Guards can insert their own TRE leaves" ON public.leaves;
CREATE POLICY "Guards can insert their own TRE leaves"
  ON public.leaves FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'guard'::app_role)
    AND guard_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND leave_type = 'TRE'
    AND status = 'PENDING'
  );
