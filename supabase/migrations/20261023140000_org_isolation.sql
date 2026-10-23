-- Isolamento entre organizações (multi-tenant) e fechamento de RPCs abertas.
--
-- Problemas (revisão de 2026-10-23):
--  1. evaluations: qualquer admin lia/editava/apagava avaliações de TODAS as organizações.
--  2. audit_logs: qualquer admin lia a auditoria de TODAS as organizações.
--  3. team_schedules / teams: qualquer guard (e admin) via escalas e equipes de todas as organizações.
--  4. Vazamento de contatos: cadastro aberto + policy "Users can create their own profile" deixava
--     qualquer pessoa criar um perfil apontando admin_id para outra organização e chamar
--     get_available_guards_for_swap(), que devolvia nome/e-mail/telefone dos seguranças dela.
--     get_user_id_by_email() (anon) ajudava a mapear contas a partir do telefone.
--  5. swap_team_schedules(): SECURITY DEFINER executável por anon, sem checagem de quem chama,
--     alterava escalas de qualquer organização (o fallback nem filtrava por organização).
--     O app não usa essa função.
--
-- Organização: guard/admin pertencem à organização profiles.admin_id; o perfil do admin tem
-- admin_id = o próprio id. get_profile_id(uid) = perfil de quem está logado;
-- get_user_admin_id(uid) = organização dele.

-- 1. evaluations ---------------------------------------------------------------------------------
drop policy if exists "Admins can view all evaluations" on public.evaluations;
drop policy if exists "Admins can create evaluations" on public.evaluations;
drop policy if exists "Admins can update evaluations" on public.evaluations;
drop policy if exists "Admins can delete evaluations" on public.evaluations;

create policy "Super admins can manage all evaluations"
on public.evaluations for all to authenticated
using (has_role((select auth.uid()), 'super_admin'::app_role))
with check (has_role((select auth.uid()), 'super_admin'::app_role));

create policy "Admins can manage their organization evaluations"
on public.evaluations for all to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  and guard_id in (select p.id from public.profiles p where p.admin_id = get_profile_id((select auth.uid())))
)
with check (
  has_role((select auth.uid()), 'admin'::app_role)
  and guard_id in (select p.id from public.profiles p where p.admin_id = get_profile_id((select auth.uid())))
);

-- 2. audit_logs ----------------------------------------------------------------------------------
drop policy if exists "Admins can view organization audit logs" on public.audit_logs;

create policy "Admins can view organization audit logs"
on public.audit_logs for select to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  and user_id in (select p.id from public.profiles p where p.admin_id = get_profile_id((select auth.uid())))
);

-- 3. team_schedules / teams ----------------------------------------------------------------------
-- Admins já enxergam a própria organização pela policy ALL "Admins can manage their organization ...".
drop policy if exists "Guards can view schedules" on public.team_schedules;

create policy "Guards can view their organization schedules"
on public.team_schedules for select to authenticated
using (
  has_role((select auth.uid()), 'guard'::app_role)
  and admin_id = get_user_admin_id((select auth.uid()))
);

drop policy if exists "Guards can view teams" on public.teams;

create policy "Guards can view their organization teams"
on public.teams for select to authenticated
using (
  has_role((select auth.uid()), 'guard'::app_role)
  and admin_id = get_user_admin_id((select auth.uid()))
);

-- 4. Vazamento de contatos -----------------------------------------------------------------------
-- Perfis são criados só pelas edge functions (service role). O app nunca insere em profiles.
drop policy if exists "Users can create their own profile" on public.profiles;

-- Só guard com perfil lista colegas da própria organização para troca.
create or replace function public.get_available_guards_for_swap()
returns table(id uuid, name text, email text, phone text, team_id uuid, team_name text, team_color text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with me as (
    select id, admin_id
    from public.profiles
    where user_id = auth.uid()
      and has_role(auth.uid(), 'guard'::app_role)
  )
  select p.id, p.name, p.email, p.phone, p.team_id, t.name as team_name, t.color as team_color
  from public.profiles p
  join me on p.admin_id = me.admin_id
  left join public.teams t on t.id = p.team_id
  where p.is_active = true
    and p.user_id is not null
    and p.id <> (select id from me)
    and p.team_id is not null
$function$;

revoke execute on function public.get_available_guards_for_swap() from public, anon;
grant execute on function public.get_available_guards_for_swap() to authenticated, service_role;

-- Usada só pelas edge functions (service role) para achar login por e-mail.
revoke execute on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;

-- 5. swap_team_schedules -------------------------------------------------------------------------
-- Sem uso no app; fica disponível só para service role / SQL Editor.
revoke execute on function public.swap_team_schedules(uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.swap_team_schedules(uuid, uuid, date, date) to service_role;
