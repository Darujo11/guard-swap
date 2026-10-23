-- Assinatura eletrônica das trocas de plantão.
--
-- Cada ato da troca (solicitar, aceitar, recusar, cancelar, aprovar, rejeitar) passa a ser um ato
-- assinado, registrado PELO BANCO (não pelo navegador) numa tabela append-only:
--   quem (usuário/perfil/nome), em que papel, qual ação, a declaração aceita, quando (hora do
--   servidor), de onde (IP e navegador) e o QUE foi assinado (termos + hash SHA-256).
--
-- Exigências (só para usuários logados; service role/SQL Editor ficam de fora, como no
-- enforce_swap_request_transition):
--   * senha confirmada há no máximo 5 minutos: o claim `amr` do JWT traz o horário do último
--     login por senha. O app confirma a senha numa sessão descartável antes de cada ato.
--   * termos congelados: depois de solicitada, a troca não muda de pessoas, datas, motivo nem
--     organização (antes o colega podia editar qualquer coluna, inclusive de troca aprovada).
--
-- Verificação: o código (10 caracteres do hash dos termos, ex. "3FA9C-0B71E") vai impresso no
-- comprovante; verify_swap_document(code) é pública e devolve só o mínimo (datas, primeiros nomes,
-- assinaturas e se os termos atuais ainda batem com os assinados).
--
-- Enquadramento: assinatura eletrônica (Lei 14.063/2020). O nível aceito para este ato deve ser
-- definido por ato normativo da Câmara (art. 5º).

-- 1. Tabela de assinaturas ------------------------------------------------------------------------
create table if not exists public.swap_signatures (
  id uuid primary key default gen_random_uuid(),
  -- Sem FK de propósito: a prova da assinatura sobrevive mesmo se a troca for excluída.
  swap_id uuid not null,
  action text not null check (action in ('SOLICITOU', 'ACEITOU', 'RECUSOU', 'CANCELOU', 'APROVOU', 'REJEITOU')),
  signer_role text not null check (signer_role in ('solicitante', 'colega', 'coordenacao')),
  signer_user_id uuid not null,
  signer_profile_id uuid,
  signer_name text not null,
  declaration text not null,
  terms jsonb not null,
  terms_hash text not null,
  verification_code text not null,
  password_confirmed_at timestamptz not null,
  ip text,
  user_agent text,
  signed_at timestamptz not null default now()
);

create index if not exists idx_swap_signatures_swap_id on public.swap_signatures(swap_id);
create index if not exists idx_swap_signatures_code on public.swap_signatures(verification_code);

alter table public.swap_signatures enable row level security;
revoke all on public.swap_signatures from anon, authenticated;
grant select on public.swap_signatures to authenticated;

-- Quem enxerga a troca (RLS de swap_requests) enxerga as assinaturas dela.
drop policy if exists "Users can view signatures of swaps they can see" on public.swap_signatures;
create policy "Users can view signatures of swaps they can see"
on public.swap_signatures for select to authenticated
using (swap_id in (select s.id from public.swap_requests s));

-- Append-only: nem service role altera ou apaga uma assinatura.
create or replace function public.prevent_swap_signature_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ASSINATURA_IMUTAVEL: assinaturas eletrônicas não podem ser alteradas nem excluídas';
end;
$$;

drop trigger if exists trg_swap_signatures_immutable on public.swap_signatures;
create trigger trg_swap_signatures_immutable
  before update or delete on public.swap_signatures
  for each row execute function public.prevent_swap_signature_changes();

-- 2. Termos, hash e código -----------------------------------------------------------------------
create or replace function public.swap_terms_core(p public.swap_requests)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'swap_id', p.id,
    'requester_id', p.requester_id,
    'target_id', p.target_id,
    'requester_shift_date', p.requester_shift_date,
    'target_shift_date', p.target_shift_date,
    'reason', p.reason,
    'admin_id', p.admin_id
  )
$$;

create or replace function public.swap_terms_hash(p public.swap_requests)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(convert_to(public.swap_terms_core(p)::text, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function public.swap_verification_code(p_hash text)
returns text
language sql
immutable
as $$
  select upper(substr(p_hash, 1, 5) || '-' || substr(p_hash, 6, 5))
$$;

-- Último login por senha registrado no JWT da requisição (claim amr).
create or replace function public.jwt_password_confirmed_at()
returns timestamptz
language sql
stable
as $$
  select max(to_timestamp((e->>'timestamp')::double precision))
    from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) as e
   where e->>'method' = 'password'
$$;

create or replace function public.swap_signature_declaration(p_action text)
returns text
language sql
immutable
as $$
  select case p_action
    when 'SOLICITOU' then 'Declaro que solicito a troca de plantão nos termos acima.'
    when 'ACEITOU' then 'Declaro que li e aceito a troca de plantão nos termos acima.'
    when 'RECUSOU' then 'Declaro que recuso a troca de plantão nos termos acima.'
    when 'CANCELOU' then 'Declaro que cancelo a minha solicitação de troca de plantão.'
    when 'APROVOU' then 'Na qualidade de coordenação, aprovo a troca de plantão nos termos acima.'
    when 'REJEITOU' then 'Na qualidade de coordenação, rejeito a troca de plantão nos termos acima.'
  end
$$;

-- 3. Regras: senha recente e termos congelados (BEFORE) --------------------------------------------
create or replace function public.enforce_swap_signature_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_password_at timestamptz;
begin
  if auth.uid() is null then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if NEW.requester_id is distinct from OLD.requester_id
       or NEW.target_id is distinct from OLD.target_id
       or NEW.requester_shift_date is distinct from OLD.requester_shift_date
       or NEW.target_shift_date is distinct from OLD.target_shift_date
       or NEW.reason is distinct from OLD.reason
       or NEW.admin_id is distinct from OLD.admin_id then
      raise exception 'TERMOS_CONGELADOS: os termos de uma troca já solicitada não podem ser alterados';
    end if;

    if NEW.status is not distinct from OLD.status then
      return NEW;
    end if;
  end if;

  v_password_at := public.jwt_password_confirmed_at();
  if v_password_at is null or v_password_at < now() - interval '5 minutes' then
    raise exception 'ASSINATURA_REQUER_SENHA: confirme sua senha para assinar esta ação';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_swap_signature_rules on public.swap_requests;
create trigger trg_enforce_swap_signature_rules
  before insert or update on public.swap_requests
  for each row execute function public.enforce_swap_signature_rules();

-- 4. Registro da assinatura (AFTER: só grava se todas as outras regras passaram) -------------------
create or replace function public.record_swap_signature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.profiles%rowtype;
  v_role text;
  v_action text;
  v_hash text;
  v_headers json;
  v_requester_name text;
  v_target_name text;
begin
  if v_uid is null then
    return null;
  end if;
  if TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status then
    return null;
  end if;

  select * into v_actor from public.profiles where user_id = v_uid;

  v_role := case
    when v_actor.id = NEW.requester_id then 'solicitante'
    when v_actor.id = NEW.target_id then 'colega'
    else 'coordenacao'
  end;

  v_action := case
    when TG_OP = 'INSERT' then 'SOLICITOU'
    when NEW.status = 'ACCEPTED' then 'ACEITOU'
    when NEW.status = 'APPROVED' then 'APROVOU'
    when NEW.status = 'CANCELLED' then 'CANCELOU'
    when NEW.status = 'REJECTED' and v_role = 'colega' then 'RECUSOU'
    when NEW.status = 'REJECTED' then 'REJEITOU'
  end;
  if v_action is null then
    return null;
  end if;

  select name into v_requester_name from public.profiles where id = NEW.requester_id;
  select name into v_target_name from public.profiles where id = NEW.target_id;

  v_hash := public.swap_terms_hash(NEW);

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;

  insert into public.swap_signatures (
    swap_id, action, signer_role, signer_user_id, signer_profile_id, signer_name, declaration,
    terms, terms_hash, verification_code, password_confirmed_at, ip, user_agent
  ) values (
    NEW.id, v_action, v_role, v_uid, v_actor.id,
    coalesce(v_actor.name, auth.jwt()->>'email', v_uid::text),
    public.swap_signature_declaration(v_action),
    public.swap_terms_core(NEW) || jsonb_build_object('requester_name', v_requester_name, 'target_name', v_target_name),
    v_hash,
    public.swap_verification_code(v_hash),
    public.jwt_password_confirmed_at(),
    coalesce(v_headers->>'cf-connecting-ip', nullif(trim(split_part(v_headers->>'x-forwarded-for', ',', 1)), ''), v_headers->>'x-real-ip'),
    left(v_headers->>'user-agent', 500)
  );

  return null;
end;
$$;

drop trigger if exists trg_record_swap_signature on public.swap_requests;
create trigger trg_record_swap_signature
  after insert or update of status on public.swap_requests
  for each row execute function public.record_swap_signature();

-- Funções internas: não viram RPC.
revoke execute on function public.record_swap_signature() from public, anon, authenticated;
revoke execute on function public.enforce_swap_signature_rules() from public, anon, authenticated;
revoke execute on function public.prevent_swap_signature_changes() from public, anon, authenticated;

-- 5. Verificação pública -------------------------------------------------------------------------
-- "Fabio" -> "Fabio"; "Philipe Souza Lima" -> "Philipe L." (minimização de dados na página pública)
create or replace function public.short_person_name(p_name text)
returns text
language sql
immutable
as $$
  select case
    when p_name is null or btrim(p_name) = '' then null
    when array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1) = 1 then btrim(p_name)
    else (regexp_split_to_array(btrim(p_name), '\s+'))[1] || ' '
         || left((regexp_split_to_array(btrim(p_name), '\s+'))[array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1)], 1) || '.'
  end
$$;

create or replace function public.verify_swap_document(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Fa-f]', '', 'g'));
  v_first public.swap_signatures%rowtype;
  v_swap public.swap_requests%rowtype;
  v_signatures jsonb;
begin
  if length(v_code) <> 10 then
    return jsonb_build_object('found', false);
  end if;
  v_code := left(v_code, 5) || '-' || right(v_code, 5);

  select * into v_first from public.swap_signatures where verification_code = v_code order by signed_at limit 1;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  select * into v_swap from public.swap_requests where id = v_first.swap_id;

  select jsonb_agg(jsonb_build_object(
           'action', s.action,
           'role', s.signer_role,
           'name', public.short_person_name(s.signer_name),
           'signed_at', s.signed_at
         ) order by s.signed_at)
    into v_signatures
    from public.swap_signatures s
   where s.verification_code = v_code;

  return jsonb_build_object(
    'found', true,
    'code', v_code,
    'protocol', 'TRC-' || upper(left(v_first.swap_id::text, 8)),
    'requester', public.short_person_name(v_first.terms->>'requester_name'),
    'target', public.short_person_name(v_first.terms->>'target_name'),
    'requester_shift_date', v_first.terms->>'requester_shift_date',
    'target_shift_date', v_first.terms->>'target_shift_date',
    'swap_exists', v_swap.id is not null,
    'status', v_swap.status,
    'terms_match', v_swap.id is not null and public.swap_terms_hash(v_swap) = v_first.terms_hash,
    'signatures', coalesce(v_signatures, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.verify_swap_document(text) from public;
grant execute on function public.verify_swap_document(text) to anon, authenticated, service_role;
