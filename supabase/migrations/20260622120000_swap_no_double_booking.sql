-- Impede que um solicitante assuma o mesmo plantao (mesma data) em mais de uma troca ativa.
-- Cenario: Fabio troca com Philipe e assume o dia 17. Em seguida tenta abrir outra troca
-- (dando outro dia seu) e assumir o dia 17 do Flavio -> ficaria escalado para duas equipes
-- no mesmo dia. Este trigger bloqueia essa segunda troca.
--
-- "Assumir a data D" acontece de duas formas:
--   - como solicitante: target_shift_date = D
--   - como alvo: requester_shift_date = D
-- Consideramos como ativas as trocas em PENDING, ACCEPTED e APPROVED. REJECTED/CANCELLED sao ignoradas.

create or replace function public.check_swap_no_double_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status in ('PENDING','ACCEPTED','APPROVED') then
    if exists (
      select 1
      from public.swap_requests sr
      where sr.id is distinct from NEW.id
        and sr.status in ('PENDING','ACCEPTED','APPROVED')
        and (
          (sr.requester_id = NEW.requester_id and sr.target_shift_date = NEW.target_shift_date)
          or (sr.target_id = NEW.requester_id and sr.requester_shift_date = NEW.target_shift_date)
        )
    ) then
      raise exception
        'DUPLICATE_ASSUMED_SHIFT: solicitante % ja assume o plantao do dia %',
        NEW.requester_id, NEW.target_shift_date;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_swap_no_double_booking on public.swap_requests;
create trigger trg_swap_no_double_booking
  before insert on public.swap_requests
  for each row execute function public.check_swap_no_double_booking();
