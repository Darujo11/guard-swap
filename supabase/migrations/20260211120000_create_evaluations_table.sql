create table public.evaluations (
    id uuid not null default gen_random_uuid(),
    guard_id uuid not null references public.profiles(id) on delete cascade,
    evaluator_id uuid not null references public.profiles(id) on delete set null,
    scores jsonb not null default '{}'::jsonb,
    total_score numeric not null default 0,
    created_at timestamp with time zone not null default now(),
    
    constraint evaluations_pkey primary key (id)
);

-- Indexes for performance
create index idx_evaluations_guard_id on public.evaluations(guard_id);
create index idx_evaluations_evaluator_id on public.evaluations(evaluator_id);

-- RLS Policies
alter table public.evaluations enable row level security;

-- Admins and Super Admins can view all evaluations
create policy "Admins can view all evaluations"
on public.evaluations for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'super_admin')
);

-- Admins and Super Admins can create evaluations
create policy "Admins can create evaluations"
on public.evaluations for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'super_admin')
);

-- Guards can view their own evaluations (optional, but good practice)
create policy "Guards can view own evaluations"
on public.evaluations for select
to authenticated
using (
  guard_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);
