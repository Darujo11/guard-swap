-- Remover função antiga e recriar com telefone incluído
DROP FUNCTION IF EXISTS public.get_available_guards_for_swap();

CREATE OR REPLACE FUNCTION public.get_available_guards_for_swap()
RETURNS TABLE(id uuid, name text, email text, phone text, team_id uuid, team_name text, team_color text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with me as (
    select id, admin_id
    from public.profiles
    where user_id = auth.uid()
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