import { addDays, format, parseISO } from 'date-fns';
import { computeEffectiveSchedule, formatSwapProtocol } from '@/utils/effectiveSchedule';
import { isHourBankLeave } from '@/utils/calendarDay';
import { formatMonthLabel, getMonthRange } from '@/utils/monthlySwapReport';

/**
 * Relatório mensal de plantões (a "escala do mês" impressa pela coordenação): quem estava de plantão
 * em cada dia, depois das trocas aprovadas, dos afastamentos e das extras.
 *
 * Módulo puro, sem I/O e sem desenho: quem busca os dados é AdminMonthlyReport e quem desenha o PDF é
 * monthlyDutyReportPdf.ts.
 *
 * Regras:
 * - Escala efetiva = team_schedules + trocas APROVADAS, calculada por computeEffectiveSchedule (a mesma
 *   regra de todas as telas). Quem assume um plantão ocupa a posição de quem cedeu.
 * - Afastamento aprovado vale para todo o período (start_date a end_date), mas só aparece nos dias em
 *   que a pessoa estaria de plantão. Afastamento que não cai em nenhum plantão vira aviso.
 * - Extra de quem não está de plantão entra no dia como "extra"; extra no próprio plantão marca a pessoa.
 * - Cobertura não é ligada a um afastamento específico: o banco não registra quem cobriu quem.
 *   O dia mostra o ausente e quem fez extra, como na escala em papel.
 */

/* -------------------------------------------------------------------------- */
/*  Entrada (linhas do banco)                                                  */
/* -------------------------------------------------------------------------- */

export interface DutyReportTeam {
  id: string;
  name: string;
  color: string | null;
}

export interface DutyReportGuard {
  id: string;
  name: string;
  team_id: string | null;
  is_active?: boolean | null;
  is_shift_chief?: boolean | null;
}

export interface DutyReportSchedule {
  team_id: string;
  shift_date: string;
}

export interface DutyReportSwap {
  id: string;
  requester_id: string;
  target_id: string;
  requester_shift_date: string;
  target_shift_date: string;
  status: string;
}

export interface DutyReportLeave {
  id: string;
  guard_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  custom_type: string | null;
  status: string;
}

export interface DutyReportExtra {
  id: string;
  guard_id: string;
  extra_date: string;
  quantity: number;
  minutes: number | null;
  percentage_type: number;
  justification: string | null;
}

export interface DutyReportInput {
  /** 'YYYY-MM' */
  monthKey: string;
  teams: DutyReportTeam[];
  /** Todos os perfis da organização (os inativos só emprestam o nome). */
  guards: DutyReportGuard[];
  schedules: DutyReportSchedule[];
  swaps: DutyReportSwap[];
  leaves: DutyReportLeave[];
  extras: DutyReportExtra[];
}

/* -------------------------------------------------------------------------- */
/*  Saída                                                                      */
/* -------------------------------------------------------------------------- */

export type LeaveCategory = 'BANCO_HORAS' | 'FERIAS' | 'TRE' | 'ATESTADO' | 'OUTRO';

export interface DutyLeaveInfo {
  category: LeaveCategory;
  /** Rótulo curto que cabe na célula do dia: 'BH', 'TRE', 'FÉRIAS'... */
  code: string;
  /** Rótulo completo: 'Banco de horas', 'Atestado médico'... */
  label: string;
}

export interface DutyExtraInfo {
  /** '12h', '6h30' */
  hours: string;
  percentage: number;
  justification: string;
}

export interface DutySwapInfo {
  /** De quem era o plantão assumido. */
  withName: string;
  /** Data que a pessoa cedeu em troca deste dia. */
  otherDate: string;
  protocol: string;
}

export type DutyEntryStatus = 'duty' | 'absent' | 'extra';

export interface DutyEntry {
  guardId: string;
  name: string;
  /** duty = de plantão; absent = estaria de plantão, mas está afastado/de folga; extra = só extra. */
  status: DutyEntryStatus;
  swap?: DutySwapInfo;
  leave?: DutyLeaveInfo;
  /** Extra do dia (status 'extra', ou 'duty' quando faz extra no próprio plantão). */
  extra?: DutyExtraInfo;
}

export interface DutyReportDay {
  /** 'YYYY-MM-DD' */
  date: string;
  dayOfMonth: number;
  /** 0 = domingo. */
  weekday: number;
  /** 'Terça-feira' */
  weekdayLabel: string;
  teams: DutyReportTeam[];
  /** Ordem da escala: equipe do dia (chefe de turno primeiro), ausentes no lugar deles, extras no fim. */
  entries: DutyEntry[];
  /** Quem estava no posto: plantão + extra, sem os ausentes. */
  presentCount: number;
}

export interface ObservationLine {
  guardId: string;
  name: string;
  /** '01 e 05/12' ou, nas férias, '01/12 a 15/12'. */
  dates: string;
  /** Tipo, quando o grupo mistura tipos ('Licença-nojo', 'Falta injustificada'...). */
  detail?: string;
}

export interface DutyReportObservations {
  hourBank: ObservationLine[];
  vacation: ObservationLine[];
  tre: ObservationLine[];
  medical: ObservationLine[];
  other: ObservationLine[];
}

export interface DutyReportWarnings {
  /** TRE ainda sem decisão: a escala mostra a pessoa de plantão. */
  pendingTre: { guardName: string; dates: string }[];
  /** Afastamento aprovado que não cai em nenhum plantão da pessoa: não aparece na escala. */
  leavesWithoutShift: { guardName: string; label: string; dates: string }[];
  /** Dias do mês sem equipe cadastrada em team_schedules. */
  daysWithoutTeam: string[];
}

export interface MonthlyDutyReport {
  monthKey: string;
  /** 'Dezembro de 2026' */
  monthLabel: string;
  days: DutyReportDay[];
  /** Semanas de domingo a sábado; null = dia de outro mês. */
  weeks: (DutyReportDay | null)[][];
  observations: DutyReportObservations;
  warnings: DutyReportWarnings;
  totals: {
    daysWithTeam: number;
    /** Trocas aprovadas com ao menos um plantão no mês. */
    swaps: number;
    /** Plantões não trabalhados por afastamento ou folga. */
    absences: number;
    /** Extras lançadas no mês (uma por pessoa por dia). */
    extras: number;
  };
}

/* -------------------------------------------------------------------------- */
/*  Rótulos                                                                    */
/* -------------------------------------------------------------------------- */

export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const TEAM_FIXED_COLORS: Record<string, string> = {
  A: '#3b82f6',
  B: '#10b981',
  C: '#f59e0b',
  D: '#ef4444',
};

/** Cor da equipe nos calendários do coordenador: A-D fixas, demais pela cor cadastrada. */
export function getTeamCalendarColor(teamName?: string | null, fallback?: string | null): string {
  const normalized = (teamName || '').trim().toUpperCase();
  const match = normalized.match(/^EQUIPE\s+([A-D])$/) || normalized.match(/^([A-D])$/);
  if (match?.[1] && TEAM_FIXED_COLORS[match[1]]) return TEAM_FIXED_COLORS[match[1]];
  return fallback || '#64748b';
}

const CUSTOM_CODE_MAX = 10;

/** Tipo digitado em "Outro" cabendo na célula: 'Curso de capacitação' -> 'CURSO', 'Dispensa-médica' -> 'DISPENSA.' */
function shortCode(label: string): string {
  const upper = label.toLocaleUpperCase('pt-BR');
  if (upper.length <= CUSTOM_CODE_MAX) return upper;
  const firstWord = upper.split(/\s+/)[0];
  if (firstWord.length >= 3 && firstWord.length <= CUSTOM_CODE_MAX) return firstWord;
  return `${upper.slice(0, CUSTOM_CODE_MAX - 1).replace(/[\s.\-–]+$/, '')}.`;
}

export function describeLeave(leaveType: string, customType: string | null): DutyLeaveInfo {
  if (isHourBankLeave(leaveType, customType)) {
    return { category: 'BANCO_HORAS', code: 'BH', label: 'Banco de horas' };
  }
  switch (leaveType) {
    case 'FERIAS':
      return { category: 'FERIAS', code: 'FÉRIAS', label: 'Férias' };
    case 'TRE':
      return { category: 'TRE', code: 'TRE', label: 'TRE' };
    case 'ATESTADO':
      return { category: 'ATESTADO', code: 'ATESTADO', label: 'Atestado médico' };
    case 'FALTA_INJUSTIFICADA':
      return { category: 'OUTRO', code: 'FALTA', label: 'Falta injustificada' };
    case 'LICENCA_NOJO':
      return { category: 'OUTRO', code: 'LICENÇA', label: 'Licença-nojo' };
    case 'LICENCA_PATERNIDADE':
      return { category: 'OUTRO', code: 'LICENÇA', label: 'Licença paternidade' };
    case 'LICENCA_NAO_REMUNERADA':
      return { category: 'OUTRO', code: 'LICENÇA', label: 'Licença não remunerada' };
    default: {
      const label = customType?.trim() || 'Afastamento';
      return { category: 'OUTRO', code: shortCode(label), label };
    }
  }
}

/** quantity (horas) + minutes -> '12h', '6h30', '0h45'. */
export function formatExtraHours(quantity: number, minutes: number | null): string {
  const total = Math.max(0, Math.round((quantity || 0) * 60 + (minutes || 0)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** Datas do mesmo mês: ['2026-12-01', '2026-12-05'] -> '01 e 05/12'. */
export function formatDayList(dates: string[]): string {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) return '';
  const byMonth = new Map<string, string[]>();
  for (const date of sorted) {
    const month = date.slice(5, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), date.slice(8, 10)]);
  }
  const join = (items: string[]) =>
    items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
  return join(Array.from(byMonth.entries()).map(([month, days]) => `${join(days)}/${month}`));
}

const formatDayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** Período das férias: '01/12 a 15/12' (ou só a data, se for um dia). */
export function formatPeriod(start: string, end: string): string {
  return start === end ? formatDayMonth(start) : `${formatDayMonth(start)} a ${formatDayMonth(end)}`;
}

/* -------------------------------------------------------------------------- */
/*  Montagem                                                                   */
/* -------------------------------------------------------------------------- */

const compareNames = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/** Datas 'YYYY-MM-DD' de um período, recortado ao mês. */
function datesInRange(start: string, end: string, monthStart: string, monthEnd: string): string[] {
  const from = start > monthStart ? start : monthStart;
  const to = end < monthEnd ? end : monthEnd;
  const dates: string[] = [];
  for (let current = parseISO(from); format(current, 'yyyy-MM-dd') <= to; current = addDays(current, 1)) {
    dates.push(format(current, 'yyyy-MM-dd'));
  }
  return dates;
}

interface SlotKey {
  teamIndex: number;
  position: number;
}

export function buildMonthlyDutyReport(input: DutyReportInput): MonthlyDutyReport {
  const { monthKey } = input;
  const { start: monthStart, end: monthEnd } = getMonthRange(monthKey);
  const inMonth = (date: string) => date >= monthStart && date <= monthEnd;

  const teamsById = new Map(input.teams.map((team) => [team.id, team]));
  const guardsById = new Map(input.guards.map((guard) => [guard.id, guard]));
  const nameOf = (guardId: string) => guardsById.get(guardId)?.name || 'Profissional removido';

  const sortedTeams = [...input.teams].sort((a, b) => compareNames(a.name, b.name));
  const teamIndex = new Map(sortedTeams.map((team, index) => [team.id, index]));

  // Quem entra na escala: ativos com equipe. A ordem dentro da equipe é a da folha: chefe de turno primeiro.
  const rosterGuards = input.guards
    .filter((guard) => guard.team_id && teamsById.has(guard.team_id) && guard.is_active !== false)
    .sort(
      (a, b) =>
        Number(!!b.is_shift_chief) - Number(!!a.is_shift_chief) || compareNames(a.name, b.name) || a.id.localeCompare(b.id)
    );
  const positionInTeam = new Map<string, number>();
  const teamCounters = new Map<string, number>();
  for (const guard of rosterGuards) {
    const next = teamCounters.get(guard.team_id!) ?? 0;
    positionInTeam.set(guard.id, next);
    teamCounters.set(guard.team_id!, next + 1);
  }

  const approvedSwaps = input.swaps.filter((swap) => swap.status === 'APPROVED');
  const swapsById = new Map(approvedSwaps.map((swap) => [swap.id, swap]));
  const person = (guardId: string) => {
    const guard = guardsById.get(guardId);
    return guard ? { team_id: guard.team_id, name: guard.name } : null;
  };
  const swapsWithPeople = approvedSwaps.map((swap) => ({
    ...swap,
    requester: person(swap.requester_id),
    target: person(swap.target_id),
  }));

  const slotOf = (guardId: string): SlotKey => {
    const guard = guardsById.get(guardId);
    return {
      teamIndex: guard?.team_id != null ? teamIndex.get(guard.team_id) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER,
      position: positionInTeam.get(guardId) ?? Number.MAX_SAFE_INTEGER,
    };
  };

  // 1. Escala efetiva de cada pessoa (regra canônica) virada para "quem está em cada dia".
  const dutyByDate = new Map<string, { entry: DutyEntry; slot: SlotKey }[]>();
  for (const guard of rosterGuards) {
    const team = teamsById.get(guard.team_id!)!;
    const effective = computeEffectiveSchedule(
      input.schedules,
      swapsWithPeople,
      guard.id,
      team.id,
      team.color || '',
      team.name,
      input.teams.map((t) => ({ id: t.id, name: t.name, color: t.color || '' }))
    );

    effective.forEach((day, date) => {
      if (!inMonth(date) || day.isGivenAway) return;

      const entry: DutyEntry = { guardId: guard.id, name: guard.name, status: 'duty' };
      let slot = slotOf(guard.id);

      if (day.isSwapped) {
        const swap = day.swapId ? swapsById.get(day.swapId) : undefined;
        const ownerId = swap ? (swap.requester_id === guard.id ? swap.target_id : swap.requester_id) : undefined;
        entry.swap = {
          withName: day.originalOwnerName || (ownerId ? nameOf(ownerId) : 'colega'),
          otherDate: day.originalDate || '',
          protocol: day.swapProtocol || (day.swapId ? formatSwapProtocol(day.swapId) : ''),
        };
        // Quem assume ocupa o lugar de quem cedeu, como na folha riscada à mão.
        if (ownerId) slot = slotOf(ownerId);
      }

      dutyByDate.set(date, [...(dutyByDate.get(date) ?? []), { entry, slot }]);
    });
  }

  // 2. Afastamentos aprovados: só nos dias de plantão de quem se afastou.
  const approvedLeaves = [...input.leaves]
    .filter((leave) => leave.status === 'APPROVED')
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));

  const observations: DutyReportObservations = { hourBank: [], vacation: [], tre: [], medical: [], other: [] };
  const observationDates = new Map<string, { line: ObservationLine; dates: string[]; group: keyof DutyReportObservations }>();
  const warnings: DutyReportWarnings = { pendingTre: [], leavesWithoutShift: [], daysWithoutTeam: [] };

  const groupFor: Record<LeaveCategory, keyof DutyReportObservations> = {
    BANCO_HORAS: 'hourBank',
    FERIAS: 'vacation',
    TRE: 'tre',
    ATESTADO: 'medical',
    OUTRO: 'other',
  };

  for (const leave of approvedLeaves) {
    const info = describeLeave(leave.leave_type, leave.custom_type);
    const leaveDates = datesInRange(leave.start_date, leave.end_date, monthStart, monthEnd);
    const hitDates: string[] = [];

    for (const date of leaveDates) {
      const onDuty = dutyByDate.get(date)?.find(({ entry }) => entry.guardId === leave.guard_id);
      if (!onDuty || onDuty.entry.status === 'absent') continue;
      onDuty.entry.status = 'absent';
      onDuty.entry.leave = info;
      hitDates.push(date);
    }

    const group = groupFor[info.category];
    if (info.category === 'FERIAS') {
      // Férias valem pelo período, como na folha ("Servidores em férias").
      observations.vacation.push({
        guardId: leave.guard_id,
        name: nameOf(leave.guard_id),
        dates: formatPeriod(leave.start_date, leave.end_date),
      });
      continue;
    }

    if (hitDates.length === 0) {
      warnings.leavesWithoutShift.push({
        guardName: nameOf(leave.guard_id),
        label: info.label,
        dates: formatDayList(leaveDates),
      });
      continue;
    }

    const key = `${group}::${leave.guard_id}::${group === 'other' ? info.label : ''}`;
    const existing = observationDates.get(key);
    if (existing) {
      existing.dates.push(...hitDates);
    } else {
      const line: ObservationLine = {
        guardId: leave.guard_id,
        name: nameOf(leave.guard_id),
        dates: '',
        ...(group === 'other' ? { detail: info.label } : {}),
      };
      observationDates.set(key, { line, dates: [...hitDates], group });
    }
  }

  observationDates.forEach(({ line, dates, group }) => {
    observations[group].push({ ...line, dates: formatDayList(dates) });
  });
  (Object.keys(observations) as (keyof DutyReportObservations)[]).forEach((group) => {
    observations[group].sort((a, b) => compareNames(a.name, b.name) || (a.detail ?? '').localeCompare(b.detail ?? ''));
  });

  // TRE pendente não entra na escala (só aprovado vale), mas a coordenação precisa saber antes de imprimir.
  const pendingTre = new Map<string, string[]>();
  for (const leave of input.leaves) {
    if (leave.status !== 'PENDING' || leave.leave_type !== 'TRE') continue;
    const dates = datesInRange(leave.start_date, leave.end_date, monthStart, monthEnd);
    if (dates.length === 0) continue;
    pendingTre.set(leave.guard_id, [...(pendingTre.get(leave.guard_id) ?? []), ...dates]);
  }
  pendingTre.forEach((dates, guardId) => warnings.pendingTre.push({ guardName: nameOf(guardId), dates: formatDayList(dates) }));
  warnings.pendingTre.sort((a, b) => compareNames(a.guardName, b.guardName));
  warnings.leavesWithoutShift.sort((a, b) => compareNames(a.guardName, b.guardName));

  // 3. Extras: uma linha por pessoa por dia (somando os lançamentos do mesmo dia).
  const extrasByDay = new Map<string, Map<string, DutyReportExtra[]>>();
  for (const extra of input.extras) {
    if (!inMonth(extra.extra_date)) continue;
    const day = extrasByDay.get(extra.extra_date) ?? new Map<string, DutyReportExtra[]>();
    day.set(extra.guard_id, [...(day.get(extra.guard_id) ?? []), extra]);
    extrasByDay.set(extra.extra_date, day);
  }

  const summarizeExtras = (items: DutyReportExtra[]): DutyExtraInfo => {
    const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
    const quantity = sorted.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const minutes = sorted.reduce((sum, item) => sum + (item.minutes || 0), 0);
    const justifications = [...new Set(sorted.map((item) => item.justification?.trim()).filter(Boolean))];
    return {
      hours: formatExtraHours(quantity, minutes),
      percentage: sorted[0].percentage_type,
      justification: justifications.join('; '),
    };
  };

  // 4. Dias do mês.
  const schedulesByDate = new Map<string, DutyReportTeam[]>();
  for (const schedule of input.schedules) {
    if (!inMonth(schedule.shift_date)) continue;
    const team = teamsById.get(schedule.team_id);
    if (!team) continue;
    const list = schedulesByDate.get(schedule.shift_date) ?? [];
    if (!list.some((t) => t.id === team.id)) list.push(team);
    schedulesByDate.set(schedule.shift_date, list);
  }

  const days: DutyReportDay[] = datesInRange(monthStart, monthEnd, monthStart, monthEnd).map((date) => {
    const weekday = parseISO(date).getDay();
    const teams = [...(schedulesByDate.get(date) ?? [])].sort((a, b) => compareNames(a.name, b.name));

    const duty = [...(dutyByDate.get(date) ?? [])]
      .sort(
        (a, b) =>
          a.slot.teamIndex - b.slot.teamIndex ||
          a.slot.position - b.slot.position ||
          compareNames(a.entry.name, b.entry.name)
      )
      .map(({ entry }) => entry);

    const extrasToday = extrasByDay.get(date) ?? new Map<string, DutyReportExtra[]>();
    const extraOnly: DutyEntry[] = [];
    extrasToday.forEach((items, guardId) => {
      const extra = summarizeExtras(items);
      const onRoster = duty.find((entry) => entry.guardId === guardId);
      if (onRoster) onRoster.extra = extra;
      else extraOnly.push({ guardId, name: nameOf(guardId), status: 'extra', extra });
    });
    extraOnly.sort((a, b) => compareNames(a.name, b.name));

    const entries = [...duty, ...extraOnly];
    if (teams.length === 0) warnings.daysWithoutTeam.push(date);

    return {
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      weekday,
      weekdayLabel: WEEKDAY_LABELS[weekday],
      teams,
      entries,
      presentCount: entries.filter((entry) => entry.status !== 'absent').length,
    };
  });

  const weeks: (DutyReportDay | null)[][] = [];
  let week: (DutyReportDay | null)[] = Array.from({ length: days[0].weekday }, () => null);
  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push([...week, ...Array.from({ length: 7 - week.length }, () => null)]);

  const allEntries = days.flatMap((day) => day.entries);

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    days,
    weeks,
    observations,
    warnings,
    totals: {
      daysWithTeam: days.filter((day) => day.teams.length > 0).length,
      swaps: approvedSwaps.filter((swap) => inMonth(swap.requester_shift_date) || inMonth(swap.target_shift_date)).length,
      absences: allEntries.filter((entry) => entry.status === 'absent').length,
      extras: allEntries.filter((entry) => entry.extra).length,
    },
  };
}
