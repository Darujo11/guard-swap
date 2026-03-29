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
BEGIN
  SELECT team_id INTO _requester_team_id FROM profiles WHERE id = _requester_id;
  SELECT team_id INTO _target_team_id FROM profiles WHERE id = _target_id;

  IF _requester_team_id IS NULL OR _target_team_id IS NULL THEN
    RAISE EXCEPTION 'team_id not found for one or both guards';
  END IF;

  UPDATE team_schedules
    SET team_id = _target_team_id
    WHERE shift_date = _requester_shift_date AND team_id = _requester_team_id;

  UPDATE team_schedules
    SET team_id = _requester_team_id
    WHERE shift_date = _target_shift_date AND team_id = _target_team_id;
END;
$$;