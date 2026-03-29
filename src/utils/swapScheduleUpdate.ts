import { supabase } from '@/integrations/supabase/client';

/**
 * After a swap is approved, swap the team_ids in team_schedules
 * so the calendar reflects the new assignments.
 */
export async function swapTeamSchedules(
  requesterId: string,
  targetId: string,
  requesterShiftDate: string,
  targetShiftDate: string
) {
  // 1. Get team_ids for both guards
  const [{ data: requesterProfile }, { data: targetProfile }] = await Promise.all([
    supabase.from('profiles').select('team_id').eq('id', requesterId).single(),
    supabase.from('profiles').select('team_id').eq('id', targetId).single(),
  ]);

  if (!requesterProfile?.team_id || !targetProfile?.team_id) {
    console.warn('[swapTeamSchedules] Could not find team_id for one or both guards');
    return;
  }

  const requesterTeamId = requesterProfile.team_id;
  const targetTeamId = targetProfile.team_id;

  // 2. Update requester_shift_date: was requester's team → now target's team
  const { error: err1 } = await supabase
    .from('team_schedules')
    .update({ team_id: targetTeamId })
    .eq('shift_date', requesterShiftDate)
    .eq('team_id', requesterTeamId);

  // 3. Update target_shift_date: was target's team → now requester's team
  const { error: err2 } = await supabase
    .from('team_schedules')
    .update({ team_id: requesterTeamId })
    .eq('shift_date', targetShiftDate)
    .eq('team_id', targetTeamId);

  if (err1 || err2) {
    console.error('[swapTeamSchedules] Error updating schedules:', err1, err2);
    throw new Error('Erro ao atualizar a escala de plantões');
  }

  console.log(`✅ [swapTeamSchedules] Swapped schedules: ${requesterShiftDate} (${requesterTeamId}→${targetTeamId}), ${targetShiftDate} (${targetTeamId}→${requesterTeamId})`);
}
