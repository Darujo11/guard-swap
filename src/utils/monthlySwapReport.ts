import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatSwapProtocol } from '@/utils/effectiveSchedule';

/**
 * Relatório mensal de trocas aprovadas: regras puras (sem I/O e sem desenho). Quem busca os dados é
 * MonthlySwapReportDialog e quem desenha o PDF é monthlySwapReportPdf.ts.
 */

interface ReportPerson {
  name?: string | null;
  team?: { name?: string | null } | null;
}

/** Campos de swap_requests usados no relatório. */
export interface ReportSwap {
  id: string;
  requester_id: string;
  target_id: string;
  requester_shift_date: string;
  target_shift_date: string;
  status: string;
  admin_approved_at?: string | null;
  requester?: ReportPerson | null;
  target?: ReportPerson | null;
  admin_approver?: { name?: string | null } | null;
  /** De swap_signatures; trocas anteriores à assinatura eletrônica não têm. */
  verification_code?: string | null;
}

export interface ReportSide {
  name: string;
  team: string;
  /** Plantão que a pessoa cedeu (o outro assume), 'dd/MM/yyyy (qui)'. */
  date: string;
  /** A data cedida é do mês do relatório? */
  inMonth: boolean;
}

export interface MonthlySwapReportRow {
  protocol: string;
  requester: ReportSide;
  target: ReportSide;
  approvedAt: string;
  approvedBy: string;
  /** Código de verificação (XXXXX-XXXXX) ou null. */
  verificationCode: string | null;
}

export interface MonthlySwapReport {
  /** 'YYYY-MM' */
  monthKey: string;
  /** 'Outubro de 2026' */
  monthLabel: string;
  rows: MonthlySwapReportRow[];
  /** Pessoas diferentes nas trocas listadas. */
  peopleCount: number;
  /** Alguma troca tem uma das datas em outro mês (pede a nota de rodapé). */
  hasOtherMonthDates: boolean;
  /** Alguma troca não tem código de verificação (pede a nota de rodapé). */
  hasUnsigned: boolean;
}

// 'YYYY-MM-DD' é data sem hora: new Date('2026-10-01') cairia em 30/09 no fuso do Brasil.
const parseDateOnly = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// O ptBR do date-fns abrevia sábado como 'sab', sem acento.
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const fmtShiftDate = (value: string) => {
  const date = parseDateOnly(value);
  return `${format(date, 'dd/MM/yyyy')} (${WEEKDAYS[date.getDay()]})`;
};

export function formatMonthLabel(monthKey: string): string {
  const text = format(parseDateOnly(`${monthKey}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Primeiro e último dia do mês, 'YYYY-MM-DD'. */
export function getMonthRange(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split('-').map(Number);
  return { start: `${monthKey}-01`, end: format(new Date(y, m, 0), 'yyyy-MM-dd') };
}

const isInMonth = (date: string, monthKey: string) => date.startsWith(`${monthKey}-`);

/** Data da troca que a coloca no relatório: a primeira das duas que cai no mês. */
const firstDateInMonth = (swap: ReportSwap, monthKey: string) =>
  [swap.requester_shift_date, swap.target_shift_date].filter((d) => isInMonth(d, monthKey)).sort()[0];

/**
 * Junta o código de verificação às trocas. O código é o mesmo em todas as assinaturas de uma troca;
 * havendo mais de um, vale o primeiro da lista (que vem por signed_at, como em verify_swap_document).
 */
export function withVerificationCodes(
  swaps: ReportSwap[],
  signatures: { swap_id: string; verification_code: string }[]
): ReportSwap[] {
  const codes = new Map<string, string>();
  for (const sig of signatures) if (!codes.has(sig.swap_id)) codes.set(sig.swap_id, sig.verification_code);
  return swaps.map((swap) => ({ ...swap, verification_code: codes.get(swap.id) ?? null }));
}

/**
 * O mês é o dos PLANTÕES, não o da aprovação: entra toda troca aprovada com pelo menos uma das duas
 * datas no mês (mesma regra do filtro de AdminSwaps e de swapMonthGroups). Uma troca entre outubro e
 * novembro aparece nos dois relatórios.
 */
export function buildMonthlySwapReport(swaps: ReportSwap[], monthKey: string): MonthlySwapReport {
  const selected = swaps
    .filter((swap) => swap.status === 'APPROVED' && firstDateInMonth(swap, monthKey))
    .sort(
      (a, b) =>
        firstDateInMonth(a, monthKey).localeCompare(firstDateInMonth(b, monthKey)) ||
        (a.requester?.name ?? '').localeCompare(b.requester?.name ?? '', 'pt-BR') ||
        a.id.localeCompare(b.id)
    );

  const side = (person: ReportPerson | null | undefined, date: string): ReportSide => ({
    name: person?.name || '-',
    team: person?.team?.name || 'Sem equipe',
    date: fmtShiftDate(date),
    inMonth: isInMonth(date, monthKey),
  });

  const rows = selected.map((swap) => ({
    protocol: formatSwapProtocol(swap.id),
    requester: side(swap.requester, swap.requester_shift_date),
    target: side(swap.target, swap.target_shift_date),
    approvedAt: swap.admin_approved_at ? format(new Date(swap.admin_approved_at), 'dd/MM/yyyy HH:mm') : '-',
    approvedBy: swap.admin_approver?.name || '-',
    verificationCode: swap.verification_code || null,
  }));

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    rows,
    peopleCount: new Set(selected.flatMap((swap) => [swap.requester_id, swap.target_id])).size,
    hasOtherMonthDates: rows.some((row) => !row.requester.inMonth || !row.target.inMonth),
    hasUnsigned: rows.some((row) => !row.verificationCode),
  };
}
