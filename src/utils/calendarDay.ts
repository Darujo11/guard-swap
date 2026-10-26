/**
 * Aparência e explicação de um dia no calendário pessoal do segurança
 * (GuardPersonalCalendar: "Ver escala" em Seguranças e "Minha Escala").
 * Módulo puro, sem I/O: quem chama traz o dia efetivo, o extra e o afastamento.
 */
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EffectiveDay } from './effectiveSchedule';

export const CALENDAR_COLORS = {
  extra: '#B8860B',
  /** Dia não trabalhado sem penalidade: plantão cedido em troca ou folga de banco de horas. */
  off: '#D1D5DB',
  leave: '#DC2626',
} as const;

export interface CalendarLeave {
  label: string;
  /** Folga de banco de horas: dia de descanso, não afastamento. Fica cinza, não vermelho. */
  isHourBank: boolean;
}

export interface CalendarExtra {
  justification?: string | null;
  percentage_type: number;
}

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Banco de horas não tem tipo próprio em `leaves`: é cadastrado como "Outro"
 * com o nome digitado pela coordenação ("Banco de horas", "Banco de Horas", "BH"...).
 */
export function isHourBankLeave(leaveType: string, customType?: string | null): boolean {
  const text = normalize((leaveType === 'OUTRO' ? customType || '' : leaveType).replace(/_/g, ' '));
  return /\bbanco\s+(de\s+)?horas?\b/.test(text) || text === 'bh';
}

const shortDate = (date: string) => format(parseISO(date), "EEE, dd/MM", { locale: ptBR });

export interface CalendarDayView {
  /** Estilo inline do quadrado (cor sólida ou dividida). */
  style?: { background: string };
  /** Classe de cor do texto, conforme o fundo. */
  textClass: string;
  /** Fundo dividido: metade do dia não trabalhado, metade dourada do extra. */
  isSplitExtra: boolean;
  /** Linhas do tooltip; vazio quando o dia não tem nada a explicar. */
  details: string[];
}

/**
 * Prioridade de cor: afastamento/banco de horas > plantão cedido > plantão (normal ou assumido) > extra avulso.
 * Extra em dia não trabalhado (cedido, banco de horas ou afastamento) divide o quadrado ao meio
 * na diagonal: a cor do dia de um lado e o dourado do extra do outro.
 */
export function describeCalendarDay(
  workDay: EffectiveDay | undefined,
  extra: CalendarExtra | undefined,
  leave: CalendarLeave | undefined,
): CalendarDayView {
  const details: string[] = [];

  let baseColor: string | undefined;
  let darkText = false;
  let worked = false;

  if (leave) {
    baseColor = leave.isHourBank ? CALENDAR_COLORS.off : CALENDAR_COLORS.leave;
    darkText = leave.isHourBank;
    details.push(
      leave.isHourBank
        ? `${leave.label}: folga, não conta como plantão trabalhado.`
        : `${leave.label}: afastamento, não conta como plantão trabalhado.`,
    );
  } else if (workDay?.isGivenAway) {
    baseColor = CALENDAR_COLORS.off;
    darkText = true;
    const exchange = workDay.exchangedForDate ? `, em troca do dia ${shortDate(workDay.exchangedForDate)}` : '';
    details.push(`Plantão (${workDay.teamName}) cedido para ${workDay.coveredByName || 'colega'}${exchange}.`);
    details.push('Não conta como plantão trabalhado.');
  } else if (workDay) {
    worked = true;
    if (workDay.isSwapped) {
      const team = workDay.originalTeamName ? ` (${workDay.originalTeamName})` : '';
      const exchange = workDay.originalDate ? `, em troca do dia ${shortDate(workDay.originalDate)}` : '';
      details.push(`Plantão assumido de ${workDay.originalOwnerName || 'colega'}${team}${exchange}.`);
    } else {
      details.push(`Plantão: ${workDay.teamName}.`);
    }
  }

  if (workDay?.swapProtocol && (workDay.isSwapped || workDay.isGivenAway) && !leave) {
    details.push(`Troca ${workDay.swapProtocol}.`);
  }

  if (extra) {
    const justification = extra.justification?.trim() ? `: ${extra.justification.trim()}` : '';
    details.push(`Fez extra neste dia (${extra.percentage_type}%)${justification}.`);
  }

  const isSplitExtra = !!extra && !!baseColor;
  if (isSplitExtra) {
    const what = leave
      ? leave.isHourBank ? 'folga de banco de horas' : leave.label.toLowerCase()
      : 'plantão cedido na troca';
    details.push(`Metade ${leave && !leave.isHourBank ? 'vermelha' : 'cinza'}: ${what}. Metade dourada: extra.`);
  }

  let style: CalendarDayView['style'];
  if (isSplitExtra) {
    style = { background: `linear-gradient(135deg, ${baseColor} 50%, ${CALENDAR_COLORS.extra} 50%)` };
  } else if (baseColor) {
    style = { background: baseColor };
  } else if (workDay && extra) {
    style = { background: `linear-gradient(135deg, ${workDay.teamColor} 70%, ${CALENDAR_COLORS.extra} 30%)` };
  } else if (workDay) {
    style = workDay.isSwapped && workDay.originalTeamColor
      ? { background: `linear-gradient(135deg, ${workDay.teamColor} 90%, ${workDay.originalTeamColor} 10%)` }
      : { background: workDay.teamColor };
  } else if (extra) {
    style = { background: CALENDAR_COLORS.extra };
  }

  const textClass = darkText
    ? 'text-gray-800 font-semibold'
    : worked || baseColor || extra
      ? 'text-white font-semibold'
      : 'text-foreground';

  return { style, textClass, isSplitExtra, details };
}
