import { supabase } from '@/integrations/supabase/client';

export interface EffectiveDay {
  date: string;
  teamId: string;
  teamColor: string;
  teamName: string;
  isSwapped: boolean;
  originalTeamColor?: string;
  originalTeamName?: string;
  originalOwnerName?: string;
}

/**
 * Calcula a escala efetiva de um segurança para um período,
 * levando em conta trocas aprovadas (swap_requests com status APPROVED).
 *
 * Lógica:
 * 1. Começa com os dias base da equipe do segurança (team_schedules onde team_id = guardTeamId)
 * 2. Para cada troca aprovada envolvendo o segurança:
 *    - Se é requester: remove requester_shift_date, adiciona target_shift_date
 *    - Se é target: remove target_shift_date, adiciona requester_shift_date
 *
 * Retorna um Map<string, EffectiveDay> (chave = 'yyyy-MM-dd')
 */
export function computeEffectiveSchedule(
  baseSchedules: { shift_date: string; team_id: string }[],
  approvedSwaps: {
    requester_id: string;
    target_id: string;
    requester_shift_date: string;
    target_shift_date: string;
    requester?: { team_id?: string | null; name?: string } | null;
    target?: { team_id?: string | null; name?: string } | null;
  }[],
  guardId: string,
  guardTeamId: string,
  guardTeamColor: string,
  guardTeamName: string,
  allTeams: { id: string; name: string; color: string }[]
): Map<string, EffectiveDay> {
  const days = new Map<string, EffectiveDay>();

  // 1. Dias base da equipe do segurança
  baseSchedules.forEach(schedule => {
    if (schedule.team_id === guardTeamId) {
      days.set(schedule.shift_date, {
        date: schedule.shift_date,
        teamId: guardTeamId,
        teamColor: guardTeamColor,
        teamName: guardTeamName,
        isSwapped: false,
      });
    }
  });

  // 2. Aplicar trocas aprovadas
  approvedSwaps.forEach(swap => {
    const isRequester = swap.requester_id === guardId;
    const isTarget = swap.target_id === guardId;

    if (isRequester) {
      days.delete(swap.requester_shift_date);
      const otherTeamId = swap.target?.team_id;
      const otherTeam = otherTeamId ? allTeams.find(t => t.id === otherTeamId) : null;
      days.set(swap.target_shift_date, {
        date: swap.target_shift_date,
        teamId: guardTeamId,
        teamColor: guardTeamColor,
        teamName: guardTeamName,
        isSwapped: true,
        originalTeamColor: otherTeam?.color || guardTeamColor,
        originalTeamName: otherTeam?.name,
        originalOwnerName: swap.target?.name,
      });
    } else if (isTarget) {
      days.delete(swap.target_shift_date);
      const otherTeamId = swap.requester?.team_id;
      const otherTeam = otherTeamId ? allTeams.find(t => t.id === otherTeamId) : null;
      days.set(swap.requester_shift_date, {
        date: swap.requester_shift_date,
        teamId: guardTeamId,
        teamColor: guardTeamColor,
        teamName: guardTeamName,
        isSwapped: true,
        originalTeamColor: otherTeam?.color || guardTeamColor,
        originalTeamName: otherTeam?.name,
        originalOwnerName: swap.requester?.name,
      });
    }
  });

  return days;
}

/**
 * Busca trocas aprovadas envolvendo um segurança (como requester ou target).
 * Opcional: filtrar por período.
 */
export async function fetchApprovedSwaps(
  guardId: string,
  dateFrom?: string,
  dateTo?: string
) {
  let query = supabase
    .from('swap_requests')
    .select(`
      *,
      requester:profiles!swap_requests_requester_id_fkey(id, name, team_id),
      target:profiles!swap_requests_target_id_fkey(id, name, team_id)
    `)
    .eq('status', 'APPROVED')
    .or(`requester_id.eq.${guardId},target_id.eq.${guardId}`);

  if (dateFrom && dateTo) {
    // Include swaps where either date falls in the range
    query = query.or(
      `requester_shift_date.gte.${dateFrom},target_shift_date.gte.${dateFrom}`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchApprovedSwaps] Error:', error);
    return [];
  }
  return data || [];
}

/**
 * Retorna um Set<string> de datas efetivas ('yyyy-MM-dd') de um segurança.
 * Versão simplificada para uso no GuardSwapForm (só precisa saber quais dias são "dele").
 */
export function getEffectiveDatesSet(
  baseSchedules: { shift_date: string; team_id: string }[],
  approvedSwaps: {
    requester_id: string;
    target_id: string;
    requester_shift_date: string;
    target_shift_date: string;
  }[],
  guardId: string,
  guardTeamId: string
): Set<string> {
  const dates = new Set<string>();

  // Dias base da equipe
  baseSchedules.forEach(s => {
    if (s.team_id === guardTeamId) {
      dates.add(s.shift_date);
    }
  });

  // Aplicar trocas
  approvedSwaps.forEach(swap => {
    if (swap.requester_id === guardId) {
      dates.delete(swap.requester_shift_date);
      dates.add(swap.target_shift_date);
    } else if (swap.target_id === guardId) {
      dates.delete(swap.target_shift_date);
      dates.add(swap.requester_shift_date);
    }
  });

  return dates;
}
