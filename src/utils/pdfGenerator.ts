import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Evaluation } from '@/lib/types';
import { criteria, SCORE_LABELS } from '@/data/criteria';

const printEvaluationToDoc = (doc: jsPDF, evaluation: Evaluation) => {
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Avaliação de Desempenho", pageWidth / 2, 20, { align: "center" });

    // Info
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    let yPos = 40;
    const lineHeight = 8;

    doc.text(`Segurança: ${evaluation.guard?.name || "N/A"}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Data: ${new Date(evaluation.created_at).toLocaleDateString('pt-BR')} ${new Date(evaluation.created_at).toLocaleTimeString('pt-BR')}`, 14, yPos);
    yPos += lineHeight;
    doc.text(`Avaliador: ${evaluation.evaluator?.name || "N/A"}`, 14, yPos);
    yPos += lineHeight * 1.5;

    // Score Summary
    doc.setFont("helvetica", "bold");
    doc.text(`Pontuação Total: ${evaluation.total_score.toFixed(1)} / ${(criteria.length * 10).toFixed(1)}`, 14, yPos);
    yPos += lineHeight * 2;

    // Table
    const tableData = criteria.map(c => {
        const score = evaluation.scores[c.id] || 0;
        return [c.title, score.toFixed(1)];
    });

    autoTable(doc, {
        startY: yPos,
        head: [['Critério', 'Nota']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 30, halign: 'center' },
        },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(10);
    // We only print footer for the current page here, but autoTable might span multiple pages. 
    // For simplicity in this reuse, we'll let the main function handle final page numbering if needed, 
    // or just print a simple footer here.
    // However, autoTable handles page breaks.
    // Let's add a simple footer for this specific evaluation page(s).
    // Actually, simple text at bottom is fine.
    doc.text('Gerado pelo Sistema Guard Swap', pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
};

export const generateEvaluationPDF = (evaluation: Evaluation) => {
    const doc = new jsPDF();
    printEvaluationToDoc(doc, evaluation);
    doc.save(`avaliacao_${evaluation.guard?.name || 'seguranca'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateSchedulePDF = (
    guardName: string,
    teamName: string,
    monthLabel: string,
    workingDays: Map<string, { teamName: string; teamColor: string; isSwapped: boolean; originalTeamName?: string; originalOwnerName?: string }>,
    extrasMap?: Map<string, { justification: string; percentage_type: number }>
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Escala de ${guardName}`, pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Equipe: ${teamName}`, 14, 35);
    doc.text(`Mês: ${monthLabel}`, 14, 43);

    const sortedDays = Array.from(workingDays.entries()).sort(([a], [b]) => a.localeCompare(b));

    // Build combined table data: plantão days + extra-only days
    const allDates = new Set<string>();
    sortedDays.forEach(([dateStr]) => allDates.add(dateStr));
    if (extrasMap) {
        extrasMap.forEach((_, dateStr) => allDates.add(dateStr));
    }

    const sortedAllDates = Array.from(allDates).sort();

    const tableData = sortedAllDates.map(dateStr => {
        const [y, m, d] = dateStr.split('-');
        const formattedDate = `${d}/${m}/${y}`;
        const workDay = workingDays.get(dateStr);
        const extra = extrasMap?.get(dateStr);

        const teamCol = workDay ? workDay.teamName : (extra ? 'EXTRA' : '');
        
        const observations: string[] = [];
        if (workDay?.isSwapped) {
            observations.push(`Troca com ${workDay.originalOwnerName || 'N/A'} (${workDay.originalTeamName || 'N/A'})`);
        }
        if (extra) {
            observations.push(`Extra ${extra.percentage_type}% — ${extra.justification}`);
        }

        return [formattedDate, teamCol, observations.join(' | ')];
    });

    autoTable(doc, {
        startY: 52,
        head: [['Data', 'Equipe', 'Observação']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 30, halign: 'center' },
            1: { cellWidth: 40 },
            2: { cellWidth: 'auto' },
        },
        didParseCell: (data: any) => {
            // Highlight EXTRA rows with golden background
            if (data.section === 'body' && data.row.raw && data.row.raw[1] === 'EXTRA') {
                data.cell.styles.fillColor = [184, 134, 11];
                data.cell.styles.textColor = [255, 255, 255];
            }
        },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 20, doc.internal.pageSize.height - 10, { align: 'right' });
        doc.text('Gerado pelo Sistema Guard Swap', pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`escala_${guardName.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`);
};

export const generateEvaluationsSummaryPDF = (evaluations: Evaluation[]) => {
    const doc = new jsPDF();

    evaluations.forEach((evaluation, index) => {
        if (index > 0) {
            doc.addPage();
        }
        printEvaluationToDoc(doc, evaluation);
    });

    // Global Footer with page numbers logic is tricky if we want "Page X of Y" across the whole document 
    // because printEvaluationToDoc adds content that might span pages.
    // But for now, let's just save. The helper adds a simple footer on the last page of the table.
    // If we want consistent page numbering for the whole big document, we loop pages at the end.

    const pageCount = (doc as any).internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.width;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 20, doc.internal.pageSize.height - 10, { align: 'right' });
    }

    doc.save(`relatorio_completo_avaliacoes_${new Date().toISOString().split('T')[0]}.pdf`);
};
