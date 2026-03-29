import { supabase } from '@/integrations/supabase/client';

/**
 * After a swap is approved, swap the team_ids in team_schedules
 * so the calendar reflects the new assignments.
 * Uses a SECURITY DEFINER function to bypass RLS.
 */
export async function swapTeamSchedules(
  requesterId: string,
  targetId: string,
  requesterShiftDate: string,
  targetShiftDate: string
) {
  const { error } = await supabase.rpc('swap_team_schedules' as any, {
    _requester_id: requesterId,
    _target_id: targetId,
    _requester_shift_date: requesterShiftDate,
    _target_shift_date: targetShiftDate,
  });

  if (error) {
    console.error('[swapTeamSchedules] RPC error:', error);
    throw new Error('Erro ao atualizar a escala de plantões');
  }

  console.log(`✅ [swapTeamSchedules] Swapped schedules via RPC: ${requesterShiftDate} ↔ ${targetShiftDate}`);
}
