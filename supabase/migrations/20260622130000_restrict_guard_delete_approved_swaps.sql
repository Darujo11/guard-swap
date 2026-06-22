-- Apos a aprovacao do coordenador, a troca so pode ser excluida pelo coordenador.
-- Antes, a politica permitia que o guarda excluisse qualquer troca propria, inclusive APPROVED,
-- o que reverteria silenciosamente uma mudanca de escala ja efetivada.
-- Admins e super_admins mantem exclusao total via suas politicas FOR ALL existentes.

drop policy if exists "Guards can delete their own swap requests" on public.swap_requests;

create policy "Guards can delete their own swap requests"
on public.swap_requests
for delete
to authenticated
using (
  has_role(auth.uid(), 'guard'::app_role)
  and requester_id in (select id from profiles where user_id = auth.uid())
  and status <> 'APPROVED'
);
