import { supabase } from '@/integrations/supabase/client';

/**
 * Protocolo curto e legivel de uma troca, derivado do id da solicitacao.
 * Os 8 primeiros caracteres sao os mesmos exibidos em AdminSwaps/GuardSwapList,
 * o que permite cruzar o documento com a tela de trocas.
 */
export function formatSwapProtocol(swapId: string): string {
  return `TRC-${swapId.slice(0, 8).toUpperCase()}`;
}

export interface EffectiveDay {
  date: string;
  teamId: string;
  teamColor: string;
  teamName: string;
  /** Dia assumido de outro profissional por meio de troca aprovada. */
  isSwapped: boolean;
  originalTeamColor?: string;
  originalTeamName?: string;
  originalOwnerName?: string;
  /** Data que o profissional cedeu em contrapartida a este dia recebido. */
  originalDate?: string;
  /** Dia da escala base que foi cedido a outro profissional: nao e trabalhado. */
  isGivenAway?: boolean;
  coveredByName?: string;
  /** Data que o profissional recebeu em contrapartida ao dia cedido. */
  exchangedForDate?: string;
  /** Id da troca aprovada que originou o dia (recebido ou cedido). */
  swapId?: string;
  /** Protocolo formatado da troca (ver formatSwapProtocol). */
  swapProtocol?: string;
}

interface SwapInput {
  id?: string;
  requester_id: string;
  target_id: string;
  requester_shift_date: string;
  target_shift_date: string;
  requester?: { team_id?: string | null; name?: string } | null;
  target?: { team_id?: string | null; name?: string } | null;
}

/**
 * Calcula a escala efetiva de um segurança para um período,
 * levando em conta trocas aprovadas (swap_requests com status APPROVED).
 *
 * Modelo de dados: `team_schedules` é imutável e representa a escala base da equipe.
 * As trocas são um overlay aplicado na leitura — nenhuma aprovação reescreve a base.
 *
 * Lógica:
 * 1. Começa com os dias base da equipe do segurança (team_schedules onde team_id = guardTeamId)
 * 2. Marca como cedidos (`isGivenAway`) os dias que ele entregou numa troca aprovada.
 *    Esses dias continuam no mapa para o calendário poder exibi-los em cinza,
 *    mas NÃO são plantões trabalhados — quem consome para contagem, relatório ou
 *    PDF deve filtrar por `isGivenAway`.
 * 3. Marca como assumidos (`isSwapped`) os dias que ele recebeu na troca.
 *
 * Os dias recebidos são aplicados depois dos cedidos: se a mesma data cair nos dois
 * lados (dado inconsistente), prevalece o dia trabalhado.
 *
 * Retorna um Map<string, EffectiveDay> (chave = 'yyyy-MM-dd')
 */
export function computeEffectiveSchedule(
  baseSchedules: { shift_date: string; team_id: string }[],
  approvedSwaps: SwapInput[],
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

  const involved = approvedSwaps.filter(
    swap => swap.requester_id === guardId || swap.target_id === guardId
  );

  // 2. Dias cedidos (o profissional entregou o plantão a outro)
  involved.forEach(swap => {
    const isRequester = swap.requester_id === guardId;
    const givenDate = isRequester ? swap.requester_shift_date : swap.target_shift_date;
    const receivedDate = isRequester ? swap.target_shift_date : swap.requester_shift_date;
    const counterpart = isRequester ? swap.target : swap.requester;

    days.set(givenDate, {
      date: givenDate,
      teamId: guardTeamId,
      teamColor: guardTeamColor,
      teamName: guardTeamName,
      isSwapped: false,
      isGivenAway: true,
      coveredByName: counterpart?.name,
      exchangedForDate: receivedDate,
      swapId: swap.id,
      swapProtocol: swap.id ? formatSwapProtocol(swap.id) : undefined,
    });
  });

  // 3. Dias assumidos (o profissional cobre o plantão de outro)
  involved.forEach(swap => {
    const isRequester = swap.requester_id === guardId;
    const receivedDate = isRequester ? swap.target_shift_date : swap.requester_shift_date;
    const givenDate = isRequester ? swap.requester_shift_date : swap.target_shift_date;
    const counterpart = isRequester ? swap.target : swap.requester;

    const counterpartTeamId = counterpart?.team_id;
    const counterpartTeam = counterpartTeamId
      ? allTeams.find(t => t.id === counterpartTeamId)
      : null;

    days.set(receivedDate, {
      date: receivedDate,
      teamId: guardTeamId,
      teamColor: guardTeamColor,
      teamName: guardTeamName,
      isSwapped: true,
      originalTeamColor: counterpartTeam?.color || guardTeamColor,
      originalTeamName: counterpartTeam?.name,
      originalOwnerName: counterpart?.name,
      originalDate: givenDate,
      swapId: swap.id,
      swapProtocol: swap.id ? formatSwapProtocol(swap.id) : undefined,
    });
  });

  return days;
}

/**
 * Dias efetivamente trabalhados: exclui os plantões cedidos numa troca.
 * É esta a lista que vale para relatórios, contagem e PDF.
 */
export function getWorkedDays(days: Map<string, EffectiveDay>): Map<string, EffectiveDay> {
  const worked = new Map<string, EffectiveDay>();
  days.forEach((day, dateStr) => {
    if (!day.isGivenAway) worked.set(dateStr, day);
  });
  return worked;
}

/**
 * Busca trocas aprovadas envolvendo um segurança (como requester ou target).
 * Opcional: filtrar por período — inclui a troca quando qualquer uma das
 * duas datas do par cai dentro do intervalo.
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
    query = query.or(
      `and(requester_shift_date.gte.${dateFrom},requester_shift_date.lte.${dateTo}),` +
      `and(target_shift_date.gte.${dateFrom},target_shift_date.lte.${dateTo})`
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

  // Aplicar trocas: primeiro remove os cedidos, depois adiciona os assumidos
  const involved = approvedSwaps.filter(
    s => s.requester_id === guardId || s.target_id === guardId
  );

  involved.forEach(swap => {
    const isRequester = swap.requester_id === guardId;
    dates.delete(isRequester ? swap.requester_shift_date : swap.target_shift_date);
  });

  involved.forEach(swap => {
    const isRequester = swap.requester_id === guardId;
    dates.add(isRequester ? swap.target_shift_date : swap.requester_shift_date);
  });

  return dates;
}
