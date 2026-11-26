import jsPDF from 'jspdf';
import autoTable, { type CellHookData } from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  getTeamCalendarColor,
  type DutyEntry,
  type DutyReportDay,
  type MonthlyDutyReport,
  type ObservationLine,
} from '@/utils/monthlyDutyReport';

/**
 * PDF do relatório mensal de plantões (A4 paisagem), no formato da escala em papel da coordenação:
 * página 1 com a grade do mês e o quadro de observações; páginas seguintes com o detalhamento diário.
 */

type RGB = [number, number, number];

// Mesmas cores do comprovante e do relatório de trocas (swapReceipt.ts, monthlySwapReportPdf.ts).
const NAVY: RGB = [27, 43, 75];
const GOLD: RGB = [232, 185, 35];
const INK: RGB = [17, 24, 39];
const MUTED: RGB = [107, 114, 128];
const LINE: RGB = [203, 207, 214];
const SOFT: RGB = [243, 244, 246];
const SWAP_BLUE: RGB = [29, 78, 216];
const LEAVE_RED: RGB = [185, 28, 28];
const HOUR_BANK_GREY: RGB = [75, 85, 99];
/** Extra é amarelo (pedido da coordenação). */
const EXTRA_FILL: RGB = [253, 230, 90];
const EXTRA_FILL_SOFT: RGB = [254, 246, 189];
const EXTRA_INK: RGB = [92, 52, 8];

const PAGE = { width: 297, height: 210 };
const MARGIN = 8;
const BODY_TOP = 22;
const BODY_BOTTOM = PAGE.height - 12;
const PANEL_WIDTH = 66;
const PANEL_GAP = 4;
/** Proporção de logo-camara-documento.png (429 x 120). */
const LOGO = { width: 34, height: 9.5 };
const PT_TO_MM = 0.3528;

/** jspdf-autotable anexa `lastAutoTable` ao documento após desenhar a tabela. */
type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface MonthlyDutyReportNotes {
  /** "Servidores que não podem fazer hora extra" */
  noOvertime: string;
  /** "Eventos diversos (reuniões, audiências etc)" */
  events: string;
  /** "Demais observações" */
  other: string;
}

export interface MonthlyDutyReportPdfOptions {
  coordinatorName: string;
  /** Logo como data: URL; sem ela sai o nome em texto. */
  logoDataUrl?: string | null;
  notes: MonthlyDutyReportNotes;
  /** Páginas com o detalhamento diário (trocas com protocolo, horas das extras). */
  includeDetail: boolean;
  generatedAt?: Date;
}

export const monthlyDutyReportFileName = (report: MonthlyDutyReport) => `escala-${report.monthKey}.pdf`;

const hexToRgb = (hex: string): RGB => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? MUTED : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const upper = (text: string) => text.toLocaleUpperCase('pt-BR');
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** Corta o texto (fonte atual) para caber em `maxWidth`, marcando o corte com ponto. */
function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}.`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}.`;
}

/* -------------------------------------------------------------------------- */
/*  Cabeçalho e rodapé                                                         */
/* -------------------------------------------------------------------------- */

function drawBrandBand(doc: jsPDF) {
  doc.setFillColor(...NAVY).rect(0, 0, PAGE.width, 2.5, 'F');
  doc.setFillColor(...GOLD).rect(0, 2.5, PAGE.width, 0.8, 'F');
}

function drawLogo(doc: jsPDF, options: MonthlyDutyReportPdfOptions, y: number) {
  if (options.logoDataUrl) {
    doc.addImage(options.logoDataUrl, 'PNG', MARGIN, y, LOGO.width, LOGO.height);
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY);
    doc.text('Câmara Municipal de Macaé', MARGIN, y + 6.5);
  }
}

function drawMainHeader(doc: jsPDF, report: MonthlyDutyReport, options: MonthlyDutyReportPdfOptions) {
  const right = PAGE.width - MARGIN;
  drawBrandBand(doc);
  drawLogo(doc, options, 6.5);

  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...NAVY);
  doc.text(`Escala de ${report.monthLabel}`, right, 11.5, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
  doc.text(`Plantões de 24h (07:00 às 07:00)  ·  Coordenação: ${options.coordinatorName}`, right, 16.3, {
    align: 'right',
  });
  doc.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, 19.3, right, 19.3);
}

function drawDetailHeader(doc: jsPDF, report: MonthlyDutyReport, options: MonthlyDutyReportPdfOptions) {
  const right = PAGE.width - MARGIN;
  drawBrandBand(doc);
  drawLogo(doc, options, 6.5);
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY);
  doc.text('Detalhamento diário', right, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
  doc.text(`Escala de ${report.monthLabel}`, right, 15.8, { align: 'right' });
  doc.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, 19.3, right, 19.3);
}

function drawLegend(doc: jsPDF, y: number) {
  let x = MARGIN;
  doc.setFontSize(6.5);

  const sample = (draw: () => number, caption: string) => {
    x = draw() + 1.5;
    doc.setFont('helvetica', 'normal').setTextColor(...MUTED);
    doc.text(caption, x, y);
    x += doc.getTextWidth(caption) + 6;
  };

  sample(() => {
    doc.setFont('helvetica', 'bold').setTextColor(...SWAP_BLUE);
    doc.text('NOME', x, y);
    return x + doc.getTextWidth('NOME');
  }, 'plantão assumido em troca (c/ = com quem trocou)');

  sample(() => {
    doc.setFont('helvetica', 'normal').setTextColor(...MUTED);
    const w = doc.getTextWidth('NOME');
    doc.text('NOME', x, y);
    doc.setDrawColor(...MUTED).setLineWidth(0.2).line(x, y - 0.8, x + w, y - 0.8);
    doc.setFont('helvetica', 'bold').setTextColor(...LEAVE_RED);
    doc.text('ATESTADO', x + w + 1.2, y);
    return x + w + 1.2 + doc.getTextWidth('ATESTADO');
  }, 'afastado ou de folga (BH = banco de horas)');

  sample(() => {
    doc.setFont('helvetica', 'bold');
    const w = doc.getTextWidth('EXTRA') + 2;
    doc.setFillColor(...EXTRA_FILL).rect(x, y - 2.4, w, 3.1, 'F');
    doc.setTextColor(...EXTRA_INK).text('EXTRA', x + 1, y);
    return x + w;
  }, 'fez extra no dia');
}

function drawFooters(doc: jsPDF, generatedAt: Date) {
  const pages = doc.getNumberOfPages();
  const stamp = `Gerado em ${format(generatedAt, "dd/MM/yyyy 'às' HH:mm")} pelo Escala Smart`;
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const y = PAGE.height - 5;
    if (page === 1) drawLegend(doc, y);
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...MUTED);
    doc.text(`${stamp}  ·  Página ${page} de ${pages}`, PAGE.width - MARGIN, y, { align: 'right' });
  }
}

/* -------------------------------------------------------------------------- */
/*  Grade do mês                                                               */
/* -------------------------------------------------------------------------- */

interface GridMetrics {
  colWidth: number;
  rowHeight: number;
  lineHeight: number;
  fontSize: number;
}

const DAY_BAND = 4.4;
const TEAM_BAND = 4.2;

function gridMetrics(report: MonthlyDutyReport): GridMetrics {
  const gridWidth = PAGE.width - 2 * MARGIN - PANEL_WIDTH - PANEL_GAP;
  const colWidth = gridWidth / 7;
  const rowHeight = (BODY_BOTTOM - BODY_TOP) / report.weeks.length;
  const maxEntries = Math.max(5, ...report.days.map((day) => day.entries.length));
  const namesHeight = rowHeight - DAY_BAND - TEAM_BAND - 1.6;
  const lineHeight = Math.min(3.6, namesHeight / maxEntries);
  const fontSize = Math.max(4.6, Math.min(7.4, lineHeight / PT_TO_MM / 1.2));
  return { colWidth, rowHeight, lineHeight, fontSize };
}

function drawEntry(doc: jsPDF, entry: DutyEntry, x: number, top: number, width: number, m: GridMetrics) {
  const baseline = top + m.lineHeight * 0.74;
  const left = x + 1.3;
  const right = x + width - 1.3;
  const tagSize = Math.max(4.2, m.fontSize - 1.2);
  let tagWidth = 0;

  // Etiqueta à direita: EXTRA, código do afastamento ou com quem trocou.
  if (entry.status === 'extra' || entry.extra) {
    doc.setFont('helvetica', 'bold').setFontSize(tagSize);
    const label = entry.status === 'extra' ? 'EXTRA' : '+EXTRA';
    tagWidth = doc.getTextWidth(label) + 1.6;
    if (entry.status === 'extra') {
      doc.setFillColor(...EXTRA_FILL).rect(x + 0.5, top + 0.15, width - 1, m.lineHeight - 0.3, 'F');
    } else {
      doc.setFillColor(...EXTRA_FILL).rect(right - tagWidth, top + 0.35, tagWidth + 0.6, m.lineHeight - 0.7, 'F');
    }
    doc.setTextColor(...EXTRA_INK).text(label, right - 0.5, baseline, { align: 'right' });
  } else if (entry.status === 'absent' && entry.leave) {
    doc.setFont('helvetica', 'bold').setFontSize(tagSize);
    doc.setTextColor(...(entry.leave.category === 'BANCO_HORAS' ? HOUR_BANK_GREY : LEAVE_RED));
    tagWidth = doc.getTextWidth(entry.leave.code) + 1.2;
    doc.text(entry.leave.code, right, baseline, { align: 'right' });
  } else if (entry.swap) {
    // O nome tem prioridade: a etiqueta usa só o espaço que sobra (e some se não sobrar; a cor azul
    // e o detalhamento continuam mostrando a troca).
    doc.setFont('helvetica', 'bold').setFontSize(m.fontSize);
    const nameWidth = doc.getTextWidth(upper(entry.name));
    doc.setFont('helvetica', 'normal').setFontSize(tagSize).setTextColor(...SWAP_BLUE);
    const room = right - left - nameWidth - 1.2;
    if (room >= 4.5) {
      const tag = fitText(doc, `c/ ${entry.swap.withName}`, room);
      tagWidth = doc.getTextWidth(tag) + 1.2;
      doc.text(tag, right, baseline, { align: 'right' });
    }
  }

  // Nome à esquerda.
  const absent = entry.status === 'absent';
  doc.setFont('helvetica', entry.swap && !absent ? 'bold' : entry.status === 'extra' ? 'bold' : 'normal');
  doc.setFontSize(m.fontSize);
  doc.setTextColor(...(absent ? MUTED : entry.swap ? SWAP_BLUE : INK));
  const name = fitText(doc, upper(entry.name), right - left - tagWidth);
  doc.text(name, left, baseline);
  if (absent) {
    const strikeY = baseline - m.fontSize * PT_TO_MM * 0.3;
    doc.setDrawColor(...MUTED).setLineWidth(0.2).line(left, strikeY, left + doc.getTextWidth(name), strikeY);
  }
}

function drawDayCell(doc: jsPDF, day: DutyReportDay, x: number, y: number, m: GridMetrics) {
  const w = m.colWidth;
  doc.setDrawColor(...LINE).setLineWidth(0.25).rect(x, y, w, m.rowHeight);

  // Dia da semana e número.
  doc.setFillColor(...SOFT).rect(x, y, w, DAY_BAND, 'F');
  doc.setFont('helvetica', 'normal').setFontSize(6.6).setTextColor(...INK);
  doc.text(`${day.weekdayLabel} - ${day.dayOfMonth}`, x + w / 2, y + 3.05, { align: 'center' });
  doc.setDrawColor(...LINE).line(x, y + DAY_BAND, x + w, y + DAY_BAND);

  // Equipe do dia.
  const teamY = y + DAY_BAND;
  if (day.teams.length === 0) {
    doc.setFont('helvetica', 'italic').setFontSize(6.6).setTextColor(...MUTED);
    doc.text('Sem escala', x + w / 2, teamY + 2.95, { align: 'center' });
  } else {
    const label = day.teams.map((team) => team.name).join(' / ');
    doc.setFont('helvetica', 'bold').setFontSize(6.8).setTextColor(...INK);
    const text = fitText(doc, label, w - 6);
    const textWidth = doc.getTextWidth(text);
    const startX = x + (w - textWidth - 2.6) / 2;
    doc.setFillColor(...hexToRgb(getTeamCalendarColor(day.teams[0].name, day.teams[0].color)));
    doc.roundedRect(startX, teamY + 1.15, 1.9, 1.9, 0.4, 0.4, 'F');
    doc.text(text, startX + 2.6, teamY + 2.95);
  }
  doc.setDrawColor(...LINE).line(x, teamY + TEAM_BAND, x + w, teamY + TEAM_BAND);

  const namesTop = teamY + TEAM_BAND + 0.8;
  day.entries.forEach((entry, index) => drawEntry(doc, entry, x, namesTop + index * m.lineHeight, w, m));
}

function drawGrid(doc: jsPDF, report: MonthlyDutyReport) {
  const m = gridMetrics(report);
  report.weeks.forEach((week, row) => {
    week.forEach((day, col) => {
      if (day) drawDayCell(doc, day, MARGIN + col * m.colWidth, BODY_TOP + row * m.rowHeight, m);
    });
  });
}

/* -------------------------------------------------------------------------- */
/*  Quadro de observações                                                      */
/* -------------------------------------------------------------------------- */

interface PanelSection {
  title: string;
  lines: string[];
}

const observationText = (line: ObservationLine) =>
  [line.name, line.detail, line.dates].filter(Boolean).join(' – ');

function panelSections(report: MonthlyDutyReport, notes: MonthlyDutyReportNotes): PanelSection[] {
  const auto = (lines: ObservationLine[]) => lines.map(observationText);
  const manual = (text: string) => (text.trim() ? [text.trim()] : []);
  const { observations } = report;

  return [
    { title: 'Servidores que não podem fazer hora extra:', lines: manual(notes.noOvertime) },
    { title: 'Servidores com horas para folga (Banco de Horas):', lines: auto(observations.hourBank) },
    { title: 'Servidores em férias:', lines: auto(observations.vacation) },
    { title: 'Servidores com folga de TRE:', lines: auto(observations.tre) },
    { title: 'Servidores com atestado médico:', lines: auto(observations.medical) },
    ...(observations.other.length > 0 ? [{ title: 'Outros afastamentos:', lines: auto(observations.other) }] : []),
    { title: 'Eventos diversos (reuniões, audiências etc):', lines: manual(notes.events) },
    { title: 'Demais observações:', lines: manual(notes.other) },
  ];
}

function drawPanel(doc: jsPDF, report: MonthlyDutyReport, notes: MonthlyDutyReportNotes) {
  const x = PAGE.width - MARGIN - PANEL_WIDTH;
  const width = PANEL_WIDTH;
  const headerHeight = 5;
  const titleHeight = 4.2;
  const pad = 1.6;
  const available = BODY_BOTTOM - BODY_TOP - headerHeight;
  const sections = panelSections(report, notes);

  // Encolhe a letra até caber; se nem assim couber, corta as seções mais longas.
  let fontSize = 6.6;
  let wrapped: string[][] = [];
  let lineHeight = 0;
  const measure = () => {
    lineHeight = fontSize * PT_TO_MM * 1.25;
    doc.setFont('helvetica', 'normal').setFontSize(fontSize);
    wrapped = sections.map((section) =>
      section.lines.flatMap((line) => doc.splitTextToSize(line, width - 2 * pad) as string[])
    );
    return wrapped.reduce((sum, lines) => sum + titleHeight + Math.max(1, lines.length) * lineHeight + pad, 0);
  };
  let needed = measure();
  while (needed > available && fontSize > 5.2) {
    fontSize -= 0.2;
    needed = measure();
  }
  while (needed > available) {
    const longest = wrapped.reduce((best, lines, i) => (lines.length > wrapped[best].length ? i : best), 0);
    if (wrapped[longest].length <= 1) break;
    wrapped[longest] = [...wrapped[longest].slice(0, -2), '(continua no detalhamento)'];
    needed = wrapped.reduce((sum, lines) => sum + titleHeight + Math.max(1, lines.length) * lineHeight + pad, 0);
  }

  // Espaço que sobra fica dividido entre as seções, para anotação à mão como na folha de papel.
  const spare = Math.max(0, available - needed) / sections.length;

  doc.setFillColor(...NAVY).rect(x, BODY_TOP, width, headerHeight, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(255, 255, 255);
  doc.text('Observações', x + pad, BODY_TOP + 3.5);

  let y = BODY_TOP + headerHeight;
  sections.forEach((section, index) => {
    const lines = wrapped[index];
    const height = titleHeight + Math.max(1, lines.length) * lineHeight + pad + spare;
    doc.setDrawColor(...LINE).setLineWidth(0.25).rect(x, y, width, height);

    doc.setFont('helvetica', 'bold').setFontSize(6.4).setTextColor(...INK);
    doc.text(fitText(doc, section.title, width - 2 * pad), x + pad, y + 3);

    doc.setFont('helvetica', 'normal').setFontSize(fontSize).setTextColor(...INK);
    lines.forEach((line, i) => doc.text(line, x + pad, y + titleHeight + lineHeight * (i + 0.8)));
    y += height;
  });
}

/* -------------------------------------------------------------------------- */
/*  Detalhamento diário                                                        */
/* -------------------------------------------------------------------------- */

function detailRow(day: DutyReportDay): string[] {
  const present = day.entries.filter((entry) => entry.status === 'duty');
  const swaps = day.entries
    .filter((entry) => entry.swap)
    .map((entry) => {
      const other = entry.swap!.otherDate ? `, em troca de ${dayMonth(entry.swap!.otherDate)}` : '';
      return `${entry.name} no lugar de ${entry.swap!.withName} (${entry.swap!.protocol}${other})`;
    });
  const absences = day.entries
    .filter((entry) => entry.status === 'absent')
    .map((entry) => `${entry.name} – ${entry.leave?.label ?? 'Afastamento'}`);
  const extras = day.entries
    .filter((entry) => entry.extra)
    .map((entry) => {
      const extra = entry.extra!;
      const why = extra.justification ? `: ${extra.justification}` : '';
      return `${entry.name} – ${extra.hours} (${extra.percentage}%)${why}`;
    });

  return [
    `${dayMonth(day.date)}\n${day.weekdayLabel}`,
    day.teams.map((team) => team.name).join('\n') || '-',
    present.map((entry) => entry.name).join(', ') || '-',
    swaps.join('\n'),
    absences.join('\n'),
    extras.join('\n'),
  ];
}

function drawDetail(doc: jsPDF, report: MonthlyDutyReport, options: MonthlyDutyReportPdfOptions) {
  doc.addPage('a4', 'landscape');
  const body = report.days.map(detailRow);

  autoTable(doc, {
    startY: BODY_TOP + 1,
    margin: { left: MARGIN, right: MARGIN, top: BODY_TOP + 1, bottom: 12 },
    theme: 'plain',
    rowPageBreak: 'avoid',
    head: [['Dia', 'Equipe', 'De plantão', 'Trocas', 'Afastamentos e folgas', 'Extras']],
    body,
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.4, bottom: 1.4, left: 1.8, right: 1.8 },
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.1,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 21, fontStyle: 'bold' },
      1: { cellWidth: 17 },
      2: { cellWidth: 62 },
      3: { cellWidth: 60, textColor: SWAP_BLUE },
      4: { cellWidth: 45, textColor: LEAVE_RED },
      5: { cellWidth: 'auto', textColor: EXTRA_INK },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section !== 'body') return;
      const day = report.days[data.row.index];
      if (day.weekday === 0) data.cell.styles.fillColor = SOFT;
      if (data.column.index === 5 && body[data.row.index][5]) data.cell.styles.fillColor = EXTRA_FILL_SOFT;
      // Banco de horas é folga, não afastamento: cinza, como no calendário do segurança.
      const absent = day.entries.filter((entry) => entry.status === 'absent');
      if (data.column.index === 4 && absent.length > 0 && absent.every((e) => e.leave?.category === 'BANCO_HORAS')) {
        data.cell.styles.textColor = HOUR_BANK_GREY;
      }
    },
    didDrawPage: () => drawDetailHeader(doc, report, options),
  });

  return (doc as DocWithAutoTable).lastAutoTable?.finalY ?? BODY_TOP;
}

/* -------------------------------------------------------------------------- */
/*  Documento                                                                  */
/* -------------------------------------------------------------------------- */

export function buildMonthlyDutyReportPdf(report: MonthlyDutyReport, options: MonthlyDutyReportPdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setProperties({
    title: `Escala de ${report.monthLabel}`,
    subject: 'Relatório mensal de plantões',
    creator: 'Escala Smart',
  });

  drawMainHeader(doc, report, options);
  drawGrid(doc, report);
  drawPanel(doc, report, options.notes);
  if (options.includeDetail) drawDetail(doc, report, options);
  drawFooters(doc, options.generatedAt ?? new Date());

  return doc;
}
