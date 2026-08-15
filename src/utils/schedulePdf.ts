import jsPDF from 'jspdf';
import autoTable, { CellHookData } from 'jspdf-autotable';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/* -------------------------------------------------------------------------- */
/*  Contrato                                                                   */
/* -------------------------------------------------------------------------- */

export interface ScheduleReportDay {
  /** yyyy-MM-dd */
  date: string;
  /** Equipe do plantão neste dia. */
  teamName: string;
  /** Plantão assumido de outro profissional via troca aprovada. */
  isSwapped: boolean;
  /** Plantão da escala base cedido a outro profissional — não é trabalhado. */
  isGivenAway: boolean;
  /** Colega do outro lado da troca. */
  counterpartName?: string;
  /** Equipe coberta no dia assumido. */
  counterpartTeamName?: string;
  /** Data recebida/cedida em contrapartida. */
  exchangeDate?: string;
  swapProtocol?: string;
}

export interface ScheduleReportExtra {
  date: string;
  justification: string;
  percentageType: number;
}

export interface GuardScheduleReport {
  guardName: string;
  teamName: string;
  /** Primeiro dia do mês de referência (yyyy-MM-dd) — define a grade do calendário. */
  monthStart: string;
  monthLabel: string;
  days: ScheduleReportDay[];
  extras: ScheduleReportExtra[];
  /** Dias de afastamento já expandidos, com o rótulo do tipo. */
  leaves: Array<{ date: string; label: string }>;
}

/* -------------------------------------------------------------------------- */
/*  Paleta                                                                     */
/* -------------------------------------------------------------------------- */

type RGB = [number, number, number];

const INK: RGB = [11, 18, 32];
const BAND: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const HAIRLINE: RGB = [226, 232, 240];
const WHITE: RGB = [255, 255, 255];

/** Plantão trabalhado. */
const BLUE: RGB = [37, 99, 235];
/** Plantão assumido por troca. */
const RED: RGB = [220, 38, 38];
/** Hora extra. */
const GOLD: RGB = [184, 134, 11];
/** Plantão cedido (não trabalhado). */
const GREY: RGB = [203, 213, 225];
/** Afastamento. */
const SLATE: RGB = [71, 85, 105];

const MARGIN = 14;

const WEEKDAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** jspdf-autotable anexa `lastAutoTable` ao documento após desenhar a tabela. */
type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

/** Posição vertical final da última tabela desenhada. */
function lastTableY(doc: jsPDF, fallback: number): number {
  return (doc as DocWithAutoTable).lastAutoTable?.finalY ?? fallback;
}

/* -------------------------------------------------------------------------- */
/*  Classificação do dia                                                       */
/* -------------------------------------------------------------------------- */

export type DayKind = 'leave' | 'given-away' | 'swap' | 'shift' | 'extra' | 'empty';

export interface ResolvedDay {
  date: string;
  kind: DayKind;
  day?: ScheduleReportDay;
  extra?: ScheduleReportExtra;
  leaveLabel?: string;
}

const KIND_COLOR: Record<Exclude<DayKind, 'empty'>, RGB> = {
  leave: SLATE,
  'given-away': GREY,
  swap: RED,
  shift: BLUE,
  extra: GOLD,
};

const KIND_LABEL: Record<Exclude<DayKind, 'empty'>, string> = {
  leave: 'Afastamento',
  'given-away': 'Cedido',
  swap: 'Troca',
  shift: 'Plantão',
  extra: 'Extra',
};

/**
 * Consolida plantões, extras e afastamentos numa única linha por data.
 * A precedência resolve o que a pessoa de fato fez no dia:
 * afastamento > plantão cedido > plantão assumido > plantão normal > extra avulso.
 */
export function resolveDays(report: GuardScheduleReport): Map<string, ResolvedDay> {
  const byDate = new Map<string, ResolvedDay>();

  const ensure = (date: string): ResolvedDay => {
    let entry = byDate.get(date);
    if (!entry) {
      entry = { date, kind: 'empty' };
      byDate.set(date, entry);
    }
    return entry;
  };

  report.days.forEach(day => {
    const entry = ensure(day.date);
    entry.day = day;
  });

  report.extras.forEach(extra => {
    const entry = ensure(extra.date);
    entry.extra = extra;
  });

  report.leaves.forEach(leave => {
    const entry = ensure(leave.date);
    entry.leaveLabel = leave.label;
  });

  byDate.forEach(entry => {
    if (entry.leaveLabel) entry.kind = 'leave';
    else if (entry.day?.isGivenAway) entry.kind = 'given-away';
    else if (entry.day?.isSwapped) entry.kind = 'swap';
    else if (entry.day) entry.kind = 'shift';
    else if (entry.extra) entry.kind = 'extra';
  });

  return byDate;
}

function formatShortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

function formatFullDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** Nome de equipe sem o prefixo redundante ("Equipe A" -> "A"). */
function shortTeam(name?: string): string {
  if (!name) return '-';
  return name.replace(/^Equipe\s*/i, '');
}

export function describe(entry: ResolvedDay): string {
  const parts: string[] = [];
  const { day, extra, leaveLabel } = entry;

  if (leaveLabel) parts.push(leaveLabel);

  if (day?.isGivenAway) {
    const who = day.counterpartName || 'colega';
    const back = day.exchangeDate ? ` · assumiu ${formatShortDate(day.exchangeDate)} em troca` : '';
    parts.push(`Plantão cedido a ${who}${back}`);
    if (day.swapProtocol) parts.push(day.swapProtocol);
  } else if (day?.isSwapped) {
    const who = day.counterpartName || 'colega';
    const team = day.counterpartTeamName ? ` (Equipe ${shortTeam(day.counterpartTeamName)})` : '';
    const gave = day.exchangeDate ? ` · cedeu ${formatShortDate(day.exchangeDate)}` : '';
    parts.push(`Assumiu plantão de ${who}${team}${gave}`);
    if (day.swapProtocol) parts.push(day.swapProtocol);
  }

  if (extra) {
    // Travessão (—) não existe na codificação padrão do jsPDF: usar separador seguro.
    parts.push(`Extra ${extra.percentageType}%${extra.justification ? `: ${extra.justification}` : ''}`);
  }

  return parts.join(' · ');
}

/* -------------------------------------------------------------------------- */
/*  Blocos de desenho                                                          */
/* -------------------------------------------------------------------------- */

function drawHeader(doc: jsPDF, report: GuardScheduleReport): number {
  const pageWidth = doc.internal.pageSize.width;
  const bandHeight = 30;

  doc.setFillColor(...BAND);
  doc.rect(0, 0, pageWidth, bandHeight, 'F');

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ESCALA DE SERVIÇO', MARGIN, 11);

  doc.setTextColor(...WHITE);
  doc.setFontSize(17);
  doc.text(report.guardName, MARGIN, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Equipe ${shortTeam(report.teamName)}`, MARGIN, 26.5);

  const monthText = report.monthLabel.toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(monthText, pageWidth - MARGIN, 21, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth - MARGIN,
    26.5,
    { align: 'right' }
  );

  return bandHeight;
}

export interface Totals {
  /** Plantões efetivamente trabalhados (exclui cedidos e dias de afastamento). */
  shifts: number;
  swaps: number;
  extras: number;
  givenAway: number;
  leaves: number;
}

export function computeTotals(resolved: Map<string, ResolvedDay>): Totals {
  const totals: Totals = { shifts: 0, swaps: 0, extras: 0, givenAway: 0, leaves: 0 };
  resolved.forEach(entry => {
    if (entry.extra) totals.extras += 1;
    switch (entry.kind) {
      case 'leave':
        totals.leaves += 1;
        break;
      case 'given-away':
        totals.givenAway += 1;
        break;
      case 'swap':
        totals.shifts += 1;
        totals.swaps += 1;
        break;
      case 'shift':
        totals.shifts += 1;
        break;
      default:
        break;
    }
  });
  return totals;
}

function drawSummary(doc: jsPDF, y: number, totals: Totals): number {
  const pageWidth = doc.internal.pageSize.width;
  const cards: Array<{ label: string; value: number; color: RGB }> = [
    { label: 'Plantões', value: totals.shifts, color: BLUE },
    { label: 'Trocas', value: totals.swaps, color: RED },
    { label: 'Extras', value: totals.extras, color: GOLD },
    { label: 'Cedidos', value: totals.givenAway, color: GREY },
    { label: 'Afastamentos', value: totals.leaves, color: SLATE },
  ];

  const gap = 3;
  const available = pageWidth - MARGIN * 2;
  const cardWidth = (available - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 16;

  cards.forEach((card, index) => {
    const x = MARGIN + index * (cardWidth + gap);

    doc.setFillColor(250, 250, 251);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.2, 1.2, 'FD');

    // Marcador de cor da categoria
    doc.setFillColor(...card.color);
    doc.roundedRect(x, y, 1.4, cardHeight, 0.7, 0.7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text(String(card.value), x + 5, y + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(card.label.toUpperCase(), x + 5, y + 13);
  });

  return y + cardHeight;
}

function drawCalendar(doc: jsPDF, y: number, report: GuardScheduleReport, resolved: Map<string, ResolvedDay>): number {
  const pageWidth = doc.internal.pageSize.width;
  const available = pageWidth - MARGIN * 2;
  const cellWidth = available / 7;
  const cellHeight = 12.5;

  const monthDate = parseISO(report.monthStart);
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Cabeçalho dos dias da semana
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  WEEKDAY_LABELS.forEach((label, index) => {
    doc.text(label, MARGIN + index * cellWidth + cellWidth / 2, y + 3.5, { align: 'center' });
  });

  let cursorY = y + 5.5;

  gridDays.forEach((date, index) => {
    const column = index % 7;
    if (column === 0 && index > 0) cursorY += cellHeight;

    const x = MARGIN + column * cellWidth;
    const dateStr = format(date, 'yyyy-MM-dd');
    const inMonth = isSameMonth(date, monthDate);
    const entry = inMonth ? resolved.get(dateStr) : undefined;
    const kind = entry?.kind ?? 'empty';

    const cellX = x + 0.6;
    const cellY = cursorY + 0.6;
    const cellW = cellWidth - 1.2;
    const cellH = cellHeight - 1.2;

    if (!inMonth) {
      doc.setFillColor(252, 252, 253);
      doc.setDrawColor(...HAIRLINE);
      doc.setLineWidth(0.15);
      doc.roundedRect(cellX, cellY, cellW, cellH, 1, 1, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(203, 213, 225);
      doc.text(format(date, 'd'), cellX + 2, cellY + 4.6);
      return;
    }

    const isFilled = kind !== 'empty';
    const fill = isFilled ? KIND_COLOR[kind as Exclude<DayKind, 'empty'>] : WHITE;

    doc.setFillColor(...fill);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.15);
    doc.roundedRect(cellX, cellY, cellW, cellH, 1, 1, isFilled ? 'F' : 'FD');

    // Número do dia
    const onDark = isFilled && kind !== 'given-away';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...(onDark ? WHITE : INK));
    doc.text(format(date, 'd'), cellX + 2, cellY + 4.8);

    // Etiqueta da situação
    if (isFilled) {
      const kindKey = kind as Exclude<DayKind, 'empty'>;
      let caption = '';
      if (kind === 'leave') caption = entry?.leaveLabel || KIND_LABEL[kindKey];
      else if (kind === 'given-away') caption = entry?.day?.counterpartName?.split(' ')[0] || 'Cedido';
      else if (kind === 'swap') caption = entry?.day?.counterpartName?.split(' ')[0] || 'Troca';
      else if (kind === 'shift') caption = shortTeam(entry?.day?.teamName);
      else caption = `${entry?.extra?.percentageType ?? ''}%`;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.4);
      doc.setTextColor(...(onDark ? [235, 240, 250] as RGB : MUTED));
      doc.text(caption.slice(0, 12), cellX + 2, cellY + cellH - 3.4);

      if (kind === 'given-away') {
        doc.setTextColor(...MUTED);
        doc.setFontSize(4.8);
        doc.text('CEDIDO', cellX + 2, cellY + cellH - 0.8);
      }
    }

    // Extra sobreposto a um plantão: marcador dourado no canto
    if (entry?.extra && kind !== 'extra' && kind !== 'leave') {
      doc.setFillColor(...GOLD);
      doc.circle(cellX + cellW - 2.4, cellY + 2.6, 1.3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.6);
      doc.setTextColor(...WHITE);
      doc.text('E', cellX + cellW - 2.4, cellY + 3.3, { align: 'center' });
    }
  });

  return cursorY + cellHeight;
}

function drawLegend(doc: jsPDF, y: number): number {
  const items: Array<{ label: string; color: RGB }> = [
    { label: 'Plantão', color: BLUE },
    { label: 'Troca (assumido)', color: RED },
    { label: 'Extra', color: GOLD },
    { label: 'Cedido (não trabalhado)', color: GREY },
    { label: 'Afastamento', color: SLATE },
  ];

  let x = MARGIN;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);

  items.forEach(item => {
    doc.setFillColor(...item.color);
    doc.roundedRect(x, y, 2.6, 2.6, 0.5, 0.5, 'F');
    doc.setTextColor(...MUTED);
    doc.text(item.label, x + 4, y + 2.2);
    x += 4 + doc.getTextWidth(item.label) + 6;
  });

  return y + 4;
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(title.toUpperCase(), MARGIN, y);

  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 1.6, doc.internal.pageSize.width - MARGIN, y + 1.6);

  return y + 4;
}

const TABLE_STYLES = {
  theme: 'plain' as const,
  headStyles: {
    fillColor: [248, 250, 252] as RGB,
    textColor: MUTED,
    fontSize: 6.8,
    fontStyle: 'bold' as const,
    cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
  },
  styles: {
    fontSize: 7.4,
    cellPadding: { top: 1.7, bottom: 1.7, left: 2, right: 2 },
    textColor: INK,
    lineColor: HAIRLINE,
    lineWidth: 0.1,
  },
  alternateRowStyles: { fillColor: [252, 252, 253] as RGB },
};

function drawDaysTable(doc: jsPDF, y: number, resolved: Map<string, ResolvedDay>): number {
  const entries = Array.from(resolved.values()).sort((a, b) => a.date.localeCompare(b.date));

  const rows = entries.map(entry => {
    const weekday = WEEKDAY_LABELS[parseISO(entry.date).getDay()];
    const kindKey = entry.kind as Exclude<DayKind, 'empty'>;
    const situation = entry.kind === 'leave'
      ? (entry.leaveLabel || KIND_LABEL.leave)
      : KIND_LABEL[kindKey];

    const team = entry.day?.isSwapped
      ? `Equipe ${shortTeam(entry.day.counterpartTeamName || entry.day.teamName)}`
      : entry.day
        ? `Equipe ${shortTeam(entry.day.teamName)}`
        : '-';

    return [formatFullDate(entry.date), weekday, situation, team, describe(entry)];
  });

  autoTable(doc, {
    ...TABLE_STYLES,
    startY: y,
    head: [['Data', 'Dia', 'Situação', 'Equipe', 'Detalhamento']],
    body: rows,
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 10, textColor: MUTED },
      2: { cellWidth: 26 },
      3: { cellWidth: 20 },
      4: { cellWidth: 'auto', fontSize: 6.8, textColor: MUTED },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section !== 'body' || data.column.index !== 2) return;
      const entry = entries[data.row.index];
      if (!entry || entry.kind === 'empty') return;
      const color = KIND_COLOR[entry.kind as Exclude<DayKind, 'empty'>];
      data.cell.styles.textColor = entry.kind === 'given-away' ? MUTED : color;
      data.cell.styles.fontStyle = 'bold';
    },
  });

  return lastTableY(doc, y);
}

function drawSwapsTable(doc: jsPDF, y: number, resolved: Map<string, ResolvedDay>): number {
  // Uma linha por troca (o par cedido/assumido aparece consolidado).
  const bySwap = new Map<string, { protocol: string; counterpart: string; gave?: string; took?: string; team?: string }>();

  Array.from(resolved.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(entry => {
      const day = entry.day;
      if (!day || (!day.isSwapped && !day.isGivenAway)) return;

      const key = day.swapProtocol || `${day.date}-${day.counterpartName}`;
      const record = bySwap.get(key) || {
        protocol: day.swapProtocol || '-',
        counterpart: day.counterpartName || 'N/A',
      };

      if (day.isGivenAway) {
        record.gave = day.date;
        record.took = record.took || day.exchangeDate;
      } else {
        record.took = day.date;
        record.gave = record.gave || day.exchangeDate;
        record.team = day.counterpartTeamName;
      }

      bySwap.set(key, record);
    });

  if (bySwap.size === 0) return y;

  // Não deixar o título órfão no rodapé da página anterior à tabela.
  const minimumSpace = 24 + Math.min(bySwap.size, 3) * 6;
  let titleY = y + 6;
  if (titleY + minimumSpace > doc.internal.pageSize.height - 16) {
    doc.addPage();
    titleY = 20;
  }

  const cursorY = sectionTitle(doc, titleY, `Trocas do período (${bySwap.size})`);

  autoTable(doc, {
    ...TABLE_STYLES,
    startY: cursorY,
    head: [['Protocolo', 'Colega', 'Cedeu', 'Assumiu', 'Equipe coberta']],
    body: Array.from(bySwap.values()).map(record => [
      record.protocol,
      record.counterpart,
      record.gave ? formatFullDate(record.gave) : '-',
      record.took ? formatFullDate(record.took) : '-',
      record.team ? `Equipe ${shortTeam(record.team)}` : '-',
    ]),
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 24 },
      3: { cellWidth: 24 },
      4: { cellWidth: 28 },
    },
  });

  return lastTableY(doc, cursorY);
}

function drawFooters(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text('Escala Smart · documento gerado automaticamente', MARGIN, pageHeight - 8);
    doc.text(`${i} / ${pageCount}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
  }
}

/* -------------------------------------------------------------------------- */
/*  Renderização de um segurança                                               */
/* -------------------------------------------------------------------------- */

function renderGuard(doc: jsPDF, report: GuardScheduleReport) {
  const resolved = resolveDays(report);
  const totals = computeTotals(resolved);

  let y = drawHeader(doc, report) + 8;
  y = drawSummary(doc, y, totals) + 8;

  y = sectionTitle(doc, y, 'Calendário do mês');
  y = drawCalendar(doc, y, report, resolved) + 3;
  y = drawLegend(doc, y) + 6;

  y = sectionTitle(doc, y, 'Detalhamento por dia');
  y = drawDaysTable(doc, y, resolved);
  drawSwapsTable(doc, y, resolved);
}

/* -------------------------------------------------------------------------- */
/*  API pública                                                                */
/* -------------------------------------------------------------------------- */

export function generateGuardSchedulePDF(report: GuardScheduleReport) {
  const doc = new jsPDF('p', 'mm', 'a4');
  renderGuard(doc, report);
  drawFooters(doc);
  doc.save(
    `escala_${report.guardName.replace(/\s+/g, '_')}_${report.monthLabel.replace(/\s+/g, '_')}.pdf`
  );
}

export function generateAllGuardsSchedulePDF(reports: GuardScheduleReport[], monthLabel: string) {
  const doc = new jsPDF('p', 'mm', 'a4');

  reports.forEach((report, index) => {
    if (index > 0) doc.addPage();
    renderGuard(doc, report);
  });

  drawFooters(doc);
  doc.save(`escala_equipe_${monthLabel.replace(/\s+/g, '_')}.pdf`);
}
