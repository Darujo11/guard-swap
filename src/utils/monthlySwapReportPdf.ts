import jsPDF from 'jspdf';
import autoTable, { type CellHookData } from 'jspdf-autotable';
import { format } from 'date-fns';
import type { MonthlySwapReport } from '@/utils/monthlySwapReport';

type RGB = [number, number, number];

// Mesmas cores do comprovante de troca (swapReceipt.ts).
const NAVY: RGB = [27, 43, 75];
const GOLD: RGB = [232, 185, 35];
const INK: RGB = [31, 41, 55];
const MUTED: RGB = [107, 114, 128];
const LINE: RGB = [229, 231, 235];
const SOFT: RGB = [246, 247, 250];

const MARGIN = 14;
const FOOTER_SPACE = 16;
/** Proporção de logo-camara-documento.png (429 x 120). */
const LOGO = { width: 43, height: 12 };

/** jspdf-autotable anexa `lastAutoTable` ao documento após desenhar a tabela. */
type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface MonthlySwapReportPdfOptions {
  coordinatorName: string;
  /** Logo como data: URL; sem ela sai o nome em texto. */
  logoDataUrl?: string | null;
  /** Endereço da página de verificação, sem protocolo (ex.: 'escalasmart.com.br/#/verificar'). */
  verifyAddress?: string;
  generatedAt?: Date;
}

function drawHeader(doc: jsPDF, report: MonthlySwapReport, options: MonthlySwapReportPdfOptions): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - MARGIN;

  doc.setFillColor(...NAVY).rect(0, 0, pageWidth, 3, 'F');
  doc.setFillColor(...GOLD).rect(0, 3, pageWidth, 1, 'F');

  if (options.logoDataUrl) {
    doc.addImage(options.logoDataUrl, 'PNG', MARGIN, 9, LOGO.width, LOGO.height);
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...NAVY);
    doc.text('Câmara Municipal de Macaé', MARGIN, 17);
  }

  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...NAVY);
  doc.text('Trocas de plantão aprovadas', right, 14, { align: 'right' });
  doc.setFontSize(11).setTextColor(...INK);
  doc.text(report.monthLabel, right, 20.5, { align: 'right' });

  doc.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, 25, right, 25);

  const swapsText = `${report.rows.length} ${report.rows.length === 1 ? 'troca aprovada' : 'trocas aprovadas'}`;
  const peopleText = `${report.peopleCount} ${report.peopleCount === 1 ? 'profissional envolvido' : 'profissionais envolvidos'}`;
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...INK);
  doc.text(`${swapsText}  ·  ${peopleText}`, MARGIN, 31.5);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED);
  doc.text(`Coordenação: ${options.coordinatorName}`, right, 31.5, { align: 'right' });

  return 36;
}

function drawTable(doc: jsPDF, startY: number, report: MonthlySwapReport): number {
  const mark = (date: string, inMonth: boolean) => (inMonth ? date : `${date} *`);

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN, top: 14, bottom: FOOTER_SPACE },
    theme: 'plain',
    rowPageBreak: 'avoid',
    head: [['Nº', 'Protocolo', 'Solicitante', 'Plantão que cedeu', 'Colega', 'Plantão que cedeu', 'Aprovação', 'Cód. verificação']],
    body: report.rows.map((row, index) => [
      String(index + 1),
      row.protocol,
      `${row.requester.name}\n${row.requester.team}`,
      mark(row.requester.date, row.requester.inMonth),
      `${row.target.name}\n${row.target.team}`,
      mark(row.target.date, row.target.inMonth),
      `${row.approvedAt}\n${row.approvedBy}`,
      row.verificationCode ?? '-',
    ]),
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.1,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: SOFT },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center', textColor: MUTED },
      1: { cellWidth: 27 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 35 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 35 },
      6: { cellWidth: 38, textColor: MUTED },
      7: { cellWidth: 29, font: 'courier' },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section !== 'body') return;
      const row = report.rows[data.row.index];
      const col = data.column.index;
      if (col === 3 || col === 5) {
        const side = col === 3 ? row.requester : row.target;
        if (side.inMonth) data.cell.styles.fontStyle = 'bold';
        else data.cell.styles.textColor = MUTED;
      }
    },
  });

  return (doc as DocWithAutoTable).lastAutoTable?.finalY ?? startY;
}

function buildNotes(report: MonthlySwapReport, verifyAddress?: string): string[] {
  const notes = ['Em cada troca, um profissional assume o plantão que o outro cedeu.'];
  if (report.hasOtherMonthDates) notes.push('* Plantão de outro mês: a troca aparece também no relatório daquele mês.');
  if (verifyAddress && report.rows.some((row) => row.verificationCode)) {
    notes.push(`Verificação: confira as assinaturas eletrônicas de cada troca pelo código em ${verifyAddress}`);
  }
  if (report.hasUnsigned) notes.push('Trocas sem código de verificação são anteriores à assinatura eletrônica.');
  return notes;
}

function drawNotes(doc: jsPDF, startY: number, notes: string[]): number {
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
  notes.forEach((note, index) => doc.text(note, MARGIN, startY + index * 4));
  return startY + (notes.length - 1) * 4;
}

function drawSignature(doc: jsPDF, y: number, coordinatorName: string) {
  doc.setDrawColor(...INK).setLineWidth(0.2).line(MARGIN, y, MARGIN + 80, y);
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...INK);
  doc.text(coordinatorName, MARGIN, y + 4.5);
  doc.setFont('helvetica', 'normal').setTextColor(...MUTED);
  doc.text('Coordenação', MARGIN, y + 8.5);
  doc.text('Data: ____/____/________', MARGIN + 100, y + 4.5);
}

function drawFooters(doc: jsPDF, report: MonthlySwapReport, generatedAt: Date) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(MARGIN, pageHeight - 11, pageWidth - MARGIN, pageHeight - 11);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
    doc.text(
      `Escala Smart · Trocas aprovadas · ${report.monthLabel} · Emitido em ${format(generatedAt, "dd/MM/yyyy 'às' HH:mm")}`,
      MARGIN,
      pageHeight - 7
    );
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - MARGIN, pageHeight - 7, { align: 'right' });
  }
}

/** PDF A4 paisagem com as trocas aprovadas do mês. */
export function createMonthlySwapReportDoc(report: MonthlySwapReport, options: MonthlySwapReportPdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = drawTable(doc, drawHeader(doc, report, options), report);

  // Notas e assinatura ficam juntas e nunca por cima do rodapé.
  const notes = buildNotes(report, options.verifyAddress);
  const closingHeight = 34 + notes.length * 4;
  if (y + closingHeight > pageHeight - FOOTER_SPACE) {
    doc.addPage();
    y = 10;
  }
  y = drawNotes(doc, y + 6, notes);
  drawSignature(doc, y + 18, options.coordinatorName);

  drawFooters(doc, report, options.generatedAt ?? new Date());
  return doc;
}

export function downloadMonthlySwapReport(report: MonthlySwapReport, options: MonthlySwapReportPdfOptions) {
  createMonthlySwapReportDoc(report, options).save(`trocas-aprovadas-${report.monthKey}.pdf`);
}
