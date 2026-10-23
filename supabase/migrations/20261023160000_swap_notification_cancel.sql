-- Aviso de cancelamento: quando o solicitante cancela (PENDING -> CANCELLED), o colega passa a
-- receber WhatsApp (evento troca_cancelada, texto em supabase/functions/_shared/messages.ts).
-- Antes ninguém era avisado e o colega continuava achando que havia um pedido em aberto.

alter table public.swap_notifications drop constraint if exists swap_notifications_event_check;
alter table public.swap_notifications add constraint swap_notifications_event_check check (event in (
  'troca_solicitada',
  'troca_aceita',
  'troca_aprovada_admin',
  'troca_rejeitada_admin',
  'troca_rejeitada_alvo',
  'troca_cancelada'
));

-- Igual à versão de 20261023120000_swap_notifications_outbox.sql, mais o ramo CANCELLED.
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
    elsif NEW.status = 'CANCELLED' then
      v_event := 'troca_cancelada';
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
