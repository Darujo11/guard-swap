-- Allow admins and super_admins to delete evaluations
create policy "Admins can delete evaluations"
on public.evaluations for delete
to authenticated
using (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'super_admin')
);

-- Allow admins and super_admins to update evaluations (needed for Edit feature too if not already present, though user didn't complain about edit saving, update policy might be missing too or covered by insert if upsert used? No, update needs policy)
create policy "Admins can update evaluations"
on public.evaluations for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'super_admin')
)
with check (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'super_admin')
);
