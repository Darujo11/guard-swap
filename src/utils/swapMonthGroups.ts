import { format } from 'date-fns';

/** Campos de uma troca usados no agrupamento por mês. */
export interface MonthGroupableSwap {
  id: string;
  requester_shift_date: string;
  target_shift_date: string;
  status: string;
  target_id: string;
}

export interface SwapMonthGroups<T extends MonthGroupableSwap> {
  /** 'YYYY-MM' -> trocas com alguma das duas datas naquele mês (uma troca pode estar em dois meses). */
  groupedByMonth: Record<string, T[]>;
  /** Mais recente primeiro. */
  sortedMonthKeys: string[];
  currentMonthKey: string;
  /** Meses diferentes do atual, mais recente primeiro. */
  otherMonthKeys: string[];
  /** Trocas que só aparecem em outros meses (sem repetir e sem as já mostradas no mês atual). */
  otherMonthsRequests: T[];
  /** Dessas, quantas esperam resposta de `currentUserId` (pedido pendente feito para ele). */
  otherMonthsAwaitingMe: number;
}

const monthKeyOf = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  const [y, m] = dateStr.split('-');
  return y && m ? `${y}-${m}` : null;
};

/**
 * Lista "Minhas solicitações de troca": o mês atual fica à mostra e os demais atrás de "Ver outros
 * meses". Uma troca entra no mês de cada uma das suas duas datas.
 */
export function groupSwapsByMonth<T extends MonthGroupableSwap>(
  requests: T[],
  currentUserId: string,
  today: Date = new Date()
): SwapMonthGroups<T> {
  const groupedByMonth: Record<string, T[]> = {};
  for (const request of requests) {
    const months = new Set(
      [monthKeyOf(request.requester_shift_date), monthKeyOf(request.target_shift_date)].filter(
        (key): key is string => key !== null
      )
    );
    for (const key of months) (groupedByMonth[key] ??= []).push(request);
  }

  const sortedMonthKeys = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));
  const currentMonthKey = format(today, 'yyyy-MM');
  const otherMonthKeys = sortedMonthKeys.filter((key) => key !== currentMonthKey);

  const shownNow = new Set((groupedByMonth[currentMonthKey] ?? []).map((request) => request.id));
  const otherMonthsRequests = [
    ...new Map(
      otherMonthKeys
        .flatMap((key) => groupedByMonth[key])
        .filter((request) => !shownNow.has(request.id))
        .map((request) => [request.id, request] as const)
    ).values(),
  ];

  const otherMonthsAwaitingMe = otherMonthsRequests.filter(
    (request) => request.status === 'PENDING' && request.target_id === currentUserId
  ).length;

  return { groupedByMonth, sortedMonthKeys, currentMonthKey, otherMonthKeys, otherMonthsRequests, otherMonthsAwaitingMe };
}
