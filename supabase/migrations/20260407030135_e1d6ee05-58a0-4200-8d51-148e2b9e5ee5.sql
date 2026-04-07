-- Fix corrupted April 2026 schedule dates
-- Correct rotation from March 31 (Equipe B): C, D, A, B, C, D, A, B...
-- Team IDs: A=96f49762-c5cd-4569-bb89-9120974e1ad6, B=d8029803-d2a5-49a4-873d-c53b9d814cf7, C=0855ea10-2a80-455c-b30f-21b2ca10b494, D=5f763a8d-2f0a-41ed-924d-2ffa266e9bca

-- Date 12: should be B (currently C)
UPDATE team_schedules SET team_id = 'd8029803-d2a5-49a4-873d-c53b9d814cf7', updated_at = now()
WHERE shift_date = '2026-04-12';

-- Date 14: should be D (currently C)
UPDATE team_schedules SET team_id = '5f763a8d-2f0a-41ed-924d-2ffa266e9bca', updated_at = now()
WHERE shift_date = '2026-04-14';

-- Date 19: should be A (currently B)
UPDATE team_schedules SET team_id = '96f49762-c5cd-4569-bb89-9120974e1ad6', updated_at = now()
WHERE shift_date = '2026-04-19';

-- Date 21: should be C (currently D)
UPDATE team_schedules SET team_id = '0855ea10-2a80-455c-b30f-21b2ca10b494', updated_at = now()
WHERE shift_date = '2026-04-21';

-- Date 24: should be B (currently A)
UPDATE team_schedules SET team_id = 'd8029803-d2a5-49a4-873d-c53b9d814cf7', updated_at = now()
WHERE shift_date = '2026-04-24';

-- Date 29: should be C (currently B)
UPDATE team_schedules SET team_id = '0855ea10-2a80-455c-b30f-21b2ca10b494', updated_at = now()
WHERE shift_date = '2026-04-29';