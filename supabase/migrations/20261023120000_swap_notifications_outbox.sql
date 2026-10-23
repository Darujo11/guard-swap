-- Avisos de troca por WhatsApp disparados pelo BANCO, sem n8n e sem depender do navegador.
--
-- Antes: cada tela (GuardSwapForm, GuardSwapList, AdminDashboard, AdminSwaps) chamava a edge
-- function send-swap-webhook com nomes/telefones montados no cliente, que repassava tudo pro
-- n8n (webhook.autozapx.com/webhook/show). Problemas: se o usuario fechasse a tela o aviso nao
-- saia; o cliente escolhia o telefone de destino; o numero da chefia era fixo no n8n; e a
-- recusa pelo seguranca-alvo caia no ramo "o coordenador rejeitou".
--
-- Agora: toda mudanca de status em swap_requests grava um evento em swap_notifications (outbox)
-- e chama a edge function notify-swap-event passando SO o id do evento. A function busca nomes,
-- telefones e o coordenador (swap_requests.admin_id) no banco e envia pela Evolution API.
--
-- Eventos:
--   INSERT status PENDING          -> troca_solicitada
--   PENDING  -> ACCEPTED           -> troca_aceita
--   ACCEPTED -> APPROVED           -> troca_aprovada_admin
--   * -> REJECTED por admin        -> troca_rejeitada_admin
--   PENDING -> REJECTED pelo alvo  -> troca_rejeitada_alvo
--
-- Seguranca: notify-swap-event roda com verify_jwt = false (pg_net nao manda JWT), mas so
-- processa evento que esteja 'pending' nesta tabela e marca como 'processing' atomicamente.
-- Quem chamar a function de fora nao escolhe destino nem texto, e nao consegue reenviar.

create table if not exists public.swap_notifications (
  id uuid primary key default gen_random_uuid(),
  swap_id uuid not null references public.swap_requests(id) on delete cascade,
  event text not null check (event in (
    'troca_solicitada',
    'troca_aceita',
    'troca_aprovada_admin',
    'troca_rejeitada_admin',
    'troca_rejeitada_alvo'
  )),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (swap_id, event)
);

create index if not exists idx_swap_notifications_status on public.swap_notifications(status);

-- Sem policies: so service role (edge function / SQL Editor) le e escreve.
alter table public.swap_notifications enable row level security;
revoke all on public.swap_notifications from anon, authenticated;

create or replace function public.enqueue_swap_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event text;
  v_notification_id uuid;
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'PENDING' then
      v_event := 'troca_solicitada';
    end if;
  elsif NEW.status is distinct from OLD.status then
    if NEW.status = 'ACCEPTED' then
      v_event := 'troca_aceita';
    elsif NEW.status = 'APPROVED' then
      v_event := 'troca_aprovada_admin';
    elsif NEW.status = 'REJECTED' then
      -- Alvo so consegue rejeitar PENDING (enforce_swap_request_transition); admin grava admin_approved_by.
      if OLD.status = 'ACCEPTED'
         or NEW.admin_approved_by is not null
         or (v_uid is not null and (has_role(v_uid, 'admin'::app_role) or has_role(v_uid, 'super_admin'::app_role))) then
        v_event := 'troca_rejeitada_admin';
      else
        v_event := 'troca_rejeitada_alvo';
      end if;
    end if;
  end if;

  if v_event is null then
    return NEW;
  end if;

  -- Falha de notificacao nunca pode desfazer a troca.
  begin
    insert into public.swap_notifications (swap_id, event)
    values (NEW.id, v_event)
    on conflict (swap_id, event) do nothing
    returning id into v_notification_id;

    -- pg_net so envia depois do COMMIT, entao a function sempre enxerga o evento gravado.
    if v_notification_id is not null then
      perform net.http_post(
        url := 'https://wyoysecfbmmidjiofymg.supabase.co/functions/v1/notify-swap-event',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('notification_id', v_notification_id)
      );
    end if;
  exception when others then
    raise warning 'enqueue_swap_notification: swap % evento % falhou: %', NEW.id, v_event, SQLERRM;
  end;

  return NEW;
end;
$$;

drop trigger if exists trg_enqueue_swap_notification on public.swap_requests;
create trigger trg_enqueue_swap_notification
  after insert or update of status on public.swap_requests
  for each row
  execute function public.enqueue_swap_notification();
