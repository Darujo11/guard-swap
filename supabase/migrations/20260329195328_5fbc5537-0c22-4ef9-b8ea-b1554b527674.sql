
-- Fix rotation for Jan-Mar 2026 to match April pattern (A→B→C→D)
-- Jan 1 = Team A, Jan 2 = Team B, Jan 3 = Team C, Jan 4 = Team D, etc.

DELETE FROM team_schedules WHERE shift_date >= '2026-01-01' AND shift_date <= '2026-03-31';

INSERT INTO team_schedules (id, team_id, shift_date)
SELECT 
  gen_random_uuid(),
  CASE (d.day::date - '2026-01-01'::date) % 4
    WHEN 0 THEN '96f49762-c5cd-4569-bb89-9120974e1ad6'::uuid
    WHEN 1 THEN 'd8029803-d2a5-49a4-873d-c53b9d814cf7'::uuid
    WHEN 2 THEN '0855ea10-2a80-455c-b30f-21b2ca10b494'::uuid
    WHEN 3 THEN '5f763a8d-2f0a-41ed-924d-2ffa266e9bca'::uuid
  END,
  d.day::date
FROM generate_series('2026-01-01'::timestamp, '2026-03-31'::timestamp, '1 day'::interval) d(day);
