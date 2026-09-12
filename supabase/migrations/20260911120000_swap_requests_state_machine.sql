-- Garante NO BANCO a maquina de estados de swap_requests, em vez de confiar so na UI.
--
-- Motivacao: o AdminDashboard.tsx buscava trocas com status IN ('PENDING','ACCEPTED')
-- sem checar target_confirmation, e mostrava o botao "Aprovar" pra qualquer uma delas.
-- Resultado: admin aprovava (status='APPROVED') trocas que o segurança-alvo nunca
-- confirmou. O fix de UI (AdminDashboard.tsx) resolve o sintoma; este trigger garante
-- que nenhuma tela (essa, uma futura, ou uma chamada direta à API) consiga repetir o
-- mesmo erro, porque a regra passa a viver no Postgres, nao só no React.
--
-- Transicoes permitidas:
--   PENDING   -> ACCEPTED   : só o alvo, e só com target_confirmation = true
--   PENDING   -> REJECTED   : o alvo ou um admin/super_admin
--   PENDING   -> CANCELLED  : só o solicitante ou um admin/super_admin
--   ACCEPTED  -> APPROVED   : só admin/super_admin, e só se target_confirmation já era true
--   ACCEPTED  -> REJECTED   : só admin/super_admin
-- Qualquer outra transição (inclusive PENDING -> APPROVED direto) é bloqueada.
--
-- Além disso, guardas (target ou requester) nunca podem alterar admin_approved,
-- admin_approved_by ou admin_approved_at — mesmo sem trocar o status — porque a RLS
-- de UPDATE hoje ("Guards can update swap requests where they are target") libera
-- update em QUALQUER coluna da linha, não só status/target_confirmation.

create or replace function public.enforce_swap_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  actor_id uuid;
  actor_is_admin boolean;
  actor_is_requester boolean;
  actor_is_target boolean;
begin
  -- Sem uid (service role, SQL Editor, script de manutenção): contexto ja privilegiado,
  -- nao reforcamos aqui (mesmo criterio que a RLS ja usa pra bypassar service role).
  if v_uid is null then
    return NEW;
  end if;

  select id into actor_id from public.profiles where user_id = v_uid;

  actor_is_admin := has_role(v_uid, 'admin'::app_role) or has_role(v_uid, 'super_admin'::app_role);
  actor_is_requester := (actor_id is not null and actor_id = OLD.requester_id);
  actor_is_target := (actor_id is not null and actor_id = OLD.target_id);

  if NEW.status is distinct from OLD.status then
    if OLD.status = 'PENDING' and NEW.status = 'ACCEPTED' then
      if not actor_is_target then
        raise exception 'swap_requests %: somente o seguranca-alvo pode aceitar a troca', OLD.id;
      end if;
      if NEW.target_confirmation is not true then
        raise exception 'swap_requests %: target_confirmation deve ser true ao aceitar', OLD.id;
      end if;

    elsif OLD.status = 'PENDING' and NEW.status = 'REJECTED' then
      if not (actor_is_target or actor_is_admin) then
        raise exception 'swap_requests %: somente o alvo ou um administrador pode rejeitar', OLD.id;
      end if;

    elsif OLD.status = 'PENDING' and NEW.status = 'CANCELLED' then
      if not (actor_is_requester or actor_is_admin) then
        raise exception 'swap_requests %: somente o solicitante pode cancelar', OLD.id;
      end if;

    elsif OLD.status = 'ACCEPTED' and NEW.status = 'APPROVED' then
      if not actor_is_admin then
        raise exception 'swap_requests %: somente administradores podem aprovar', OLD.id;
      end if;
      if OLD.target_confirmation is not true then
        raise exception 'swap_requests %: nao pode ser aprovada sem confirmacao do alvo', OLD.id;
      end if;

    elsif OLD.status = 'ACCEPTED' and NEW.status = 'REJECTED' then
      if not actor_is_admin then
        raise exception 'swap_requests %: somente administradores podem rejeitar apos aceite', OLD.id;
      end if;

    else
      raise exception 'swap_requests %: transicao de status % -> % nao permitida', OLD.id, OLD.status, NEW.status;
    end if;
  end if;

  if not actor_is_admin and (
       NEW.admin_approved is distinct from OLD.admin_approved
       or NEW.admin_approved_by is distinct from OLD.admin_approved_by
       or NEW.admin_approved_at is distinct from OLD.admin_approved_at
     ) then
    raise exception 'swap_requests %: somente administradores podem alterar campos de aprovacao', OLD.id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_swap_request_transition on public.swap_requests;
create trigger trg_enforce_swap_request_transition
  before update on public.swap_requests
  for each row
  execute function public.enforce_swap_request_transition();

-- Policy que faltava: hoje só existe RLS de UPDATE pro alvo ("Guards can update swap
-- requests where they are target"). O solicitante NÃO tem policy de UPDATE nenhuma,
-- então o botão "Cancelar" em GuardSwapList.tsx (status -> CANCELLED) falha por RLS
-- em produção. Sem essa policy, o solicitante nunca consegue cancelar a própria troca.
drop policy if exists guards_cancel_own_pending_swap_requests on public.swap_requests;
create policy guards_cancel_own_pending_swap_requests
on public.swap_requests
for update
to authenticated
using (
  has_role((select auth.uid()), 'guard'::app_role)
  and requester_id in (select id from profiles where user_id = (select auth.uid()))
  and status = 'PENDING'
)
with check (
  has_role((select auth.uid()), 'guard'::app_role)
  and requester_id in (select id from profiles where user_id = (select auth.uid()))
);
