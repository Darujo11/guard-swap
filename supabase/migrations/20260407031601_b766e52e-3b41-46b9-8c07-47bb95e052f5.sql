UPDATE public.team_schedules ts
SET admin_id = t.admin_id
FROM public.teams t
WHERE ts.team_id = t.id
  AND ts.admin_id IS NULL
  AND t.admin_id IS NOT NULL;