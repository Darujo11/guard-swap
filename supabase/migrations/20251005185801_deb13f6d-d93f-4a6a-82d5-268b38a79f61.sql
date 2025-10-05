-- Function: get_available_guards_for_swap
-- Purpose: Allow authenticated guards to list other active members in the same organization (admin_id)
-- Bypasses profiles RLS safely via SECURITY DEFINER and limits returned data

create or replace function public.get_available_guards_for_swap()
returns table (
  id uuid,
  name text,
  email text,
  team_id uuid,
  team_name text,
  team_color text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, admin_id
    from public.profiles
    where user_id = auth.uid()
  )
  select p.id, p.name, p.email, p.team_id, t.name as team_name, t.color as team_color
  from public.profiles p
  join me on p.admin_id = me.admin_id
  left join public.teams t on t.id = p.team_id
  where p.is_active = true
    and p.user_id is not null
    and p.id <> (select id from me)
    and p.team_id is not null
$$;

-- Allow all authenticated users to execute
grant execute on function public.get_available_guards_for_swap() to authenticated;