CREATE OR REPLACE FUNCTION public.swap_team_schedules(
  _requester_id uuid,
  _target_id uuid,
  _requester_shift_date date,
  _target_shift_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_team_id uuid;
  _target_team_id uuid;
  _rows_affected_1 integer;
  _rows_affected_2 integer;
BEGIN
  SELECT team_id INTO _requester_team_id FROM profiles WHERE id = _requester_id;
  SELECT team_id INTO _target_team_id FROM profiles WHERE id = _target_id;

  IF _requester_team_id IS NULL OR _target_team_id IS NULL THEN
    RAISE EXCEPTION 'team_id not found for one or both guards';
  END IF;

  UPDATE team_schedules
    SET team_id = _target_team_id, updated_at = now()
    WHERE shift_date = _requester_shift_date
      AND team_id = _requester_team_id;
  GET DIAGNOSTICS _rows_affected_1 = ROW_COUNT;

  UPDATE team_schedules
    SET team_id = _requester_team_id, updated_at = now()
    WHERE shift_date = _target_shift_date
      AND team_id = _target_team_id;
  GET DIAGNOSTICS _rows_affected_2 = ROW_COUNT;

  IF _rows_affected_1 = 0 THEN
    UPDATE team_schedules
      SET team_id = _target_team_id, updated_at = now()
      WHERE shift_date = _requester_shift_date
        AND team_id IN (SELECT ts.team_id FROM team_schedules ts WHERE ts.shift_date = _requester_shift_date LIMIT 1);
  END IF;

  IF _rows_affected_2 = 0 THEN
    UPDATE team_schedules
      SET team_id = _requester_team_id, updated_at = now()
      WHERE shift_date = _target_shift_date
        AND team_id IN (SELECT ts.team_id FROM team_schedules ts WHERE ts.shift_date = _target_shift_date LIMIT 1);
  END IF;

  RAISE LOG 'swap_team_schedules: requester=%, target=%, dates=%<->%, rows1=%, rows2=%',
    _requester_id, _target_id, _requester_shift_date, _target_shift_date, _rows_affected_1, _rows_affected_2;
END;
$$;