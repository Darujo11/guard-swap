-- Corrige a auditoria de user_roles, que bloqueava TODA concessão/remoção de papel.
--
-- log_role_changes() (criada direto no banco, fora das migrations) gravava auth.uid() em
-- audit_logs.user_id. Essa coluna é NOT NULL e é FK para profiles(id), não para auth.users(id):
--   - chamada por edge function (service role): auth.uid() é NULL -> NOT NULL violation;
--   - chamada por usuário logado: auth.uid() é id de auth.users, não de profiles -> FK violation.
-- Como o trigger é AFTER INSERT OR DELETE, o erro desfazia o INSERT/DELETE em user_roles.
-- Resultado: nenhum ROLE_GRANTED jamais foi gravado e nenhum login recebeu papel desde 2025-10-04;
-- pior, create-admin / create-super-admin-phone apagam os papéis antigos ANTES de inserir o novo.
--
-- Agora: o autor é o perfil de quem está logado; sem usuário logado (service role), registra no
-- perfil do próprio alvo; sem perfil nenhum, não audita. Falha de auditoria nunca desfaz a mudança.

create or replace function public.log_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_user uuid;
  v_role_id uuid;
  v_role app_role;
  v_log_profile uuid;
begin
  if TG_OP = 'INSERT' then
    v_target_user := NEW.user_id;
    v_role_id := NEW.id;
    v_role := NEW.role;
  else
    v_target_user := OLD.user_id;
    v_role_id := OLD.id;
    v_role := OLD.role;
  end if;

  if v_actor is not null then
    select id into v_log_profile from public.profiles where user_id = v_actor;
  end if;
  if v_log_profile is null then
    select id into v_log_profile from public.profiles where user_id = v_target_user;
  end if;

  if v_log_profile is not null then
    begin
      insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
      values (
        v_log_profile,
        case when TG_OP = 'INSERT' then 'ROLE_GRANTED' else 'ROLE_REVOKED' end,
        'user_role',
        v_role_id,
        jsonb_build_object(
          'target_user_id', v_target_user,
          'role', v_role,
          'actor_user_id', v_actor,
          'actor', case when v_actor is null then 'service_role' else 'user' end
        )
      );
    exception when others then
      raise warning 'log_role_changes: auditoria de % falhou: %', v_role_id, SQLERRM;
    end;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

-- O trigger já existe em produção (criado fora das migrations); recriado aqui para o repo refletir o banco.
drop trigger if exists user_roles_audit_trigger on public.user_roles;
create trigger user_roles_audit_trigger
  after insert or delete on public.user_roles
  for each row
  execute function public.log_role_changes();
