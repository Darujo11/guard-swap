import { describe, expect, it } from 'vitest';
import { buildMonthlySwapReport, formatMonthLabel, getMonthRange, type ReportSwap } from './monthlySwapReport';
import { createMonthlySwapReportDoc } from './monthlySwapReportPdf';

const swap = (overrides: Partial<ReportSwap> = {}): ReportSwap => ({
  id: '0920e7eb-d78d-4b64-bf9d-42ecc9c1ad82',
  requester_id: 'philipe',
  target_id: 'fabio',
  requester_shift_date: '2026-10-01',
  target_shift_date: '2026-10-20',
  status: 'APPROVED',
  admin_approved_at: '2026-09-30T13:58:00',
  requester: { name: 'Philipe', team: { name: 'Equipe B' } },
  target: { name: 'Fabio', team: { name: 'Equipe A' } },
  admin_approver: { name: 'Coordenador Morais' },
  ...overrides,
});

const ids = (swaps: ReportSwap[], month: string) =>
  buildMonthlySwapReport(swaps, month).rows.map((row) => row.protocol);

describe('getMonthRange e formatMonthLabel', () => {
  it('devolve o último dia certo, inclusive em fevereiro bissexto e na virada do ano', () => {
    expect(getMonthRange('2026-10')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(getMonthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(getMonthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });

  it('escreve o mês por extenso', () => {
    expect(formatMonthLabel('2026-10')).toBe('Outubro de 2026');
  });
});

describe('buildMonthlySwapReport', () => {
  it('traz só as aprovadas', () => {
    const swaps = ['PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED', 'CANCELLED'].map((status, i) =>
      swap({ id: `${i}${'0'.repeat(7)}`, status })
    );
    expect(ids(swaps, '2026-10')).toEqual(['TRC-20000000']);
  });

  it('usa o mês dos plantões, não o da aprovação', () => {
    // Aprovada em setembro, plantões em outubro.
    expect(ids([swap()], '2026-10')).toHaveLength(1);
    expect(ids([swap()], '2026-09')).toHaveLength(0);
  });

  it('inclui o primeiro e o último dia do mês', () => {
    expect(ids([swap({ requester_shift_date: '2026-10-01', target_shift_date: '2026-10-31' })], '2026-10')).toHaveLength(1);
  });

  it('troca entre dois meses aparece nos dois e marca a data de fora', () => {
    const cross = swap({ requester_shift_date: '2026-10-30', target_shift_date: '2026-11-02' });

    const october = buildMonthlySwapReport([cross], '2026-10');
    expect(october.rows[0].requester.inMonth).toBe(true);
    expect(october.rows[0].target.inMonth).toBe(false);
    expect(october.hasOtherMonthDates).toBe(true);

    expect(buildMonthlySwapReport([cross], '2026-11').rows[0].target.inMonth).toBe(true);
    expect(buildMonthlySwapReport([cross], '2026-12').rows).toEqual([]);
  });

  it('não confunde o mesmo mês de outro ano', () => {
    expect(ids([swap()], '2025-10')).toEqual([]);
  });

  it('ordena pela primeira data que cai no mês', () => {
    const swaps = [
      swap({ id: 'cccccccc', requester_shift_date: '2026-10-25', target_shift_date: '2026-10-28' }),
      // A data de setembro não conta para a ordem de outubro.
      swap({ id: 'bbbbbbbb', requester_shift_date: '2026-09-02', target_shift_date: '2026-10-10' }),
      swap({ id: 'aaaaaaaa', requester_shift_date: '2026-10-20', target_shift_date: '2026-10-05' }),
    ];
    expect(ids(swaps, '2026-10')).toEqual(['TRC-AAAAAAAA', 'TRC-BBBBBBBB', 'TRC-CCCCCCCC']);
  });

  it('mostra a data cedida de cada um com o dia da semana, sem cair no dia anterior', () => {
    const [row] = buildMonthlySwapReport([swap()], '2026-10').rows;
    expect(row.requester).toEqual({ name: 'Philipe', team: 'Equipe B', date: '01/10/2026 (qui)', inMonth: true });
    expect(row.target).toEqual({ name: 'Fabio', team: 'Equipe A', date: '20/10/2026 (ter)', inMonth: true });
    expect(row.approvedAt).toBe('30/09/2026 13:58');
    expect(row.approvedBy).toBe('Coordenador Morais');
  });

  it('escreve sábado com acento', () => {
    const [row] = buildMonthlySwapReport([swap({ requester_shift_date: '2026-10-03' })], '2026-10').rows;
    expect(row.requester.date).toBe('03/10/2026 (sáb)');
  });

  it('conta pessoas sem repetir', () => {
    const report = buildMonthlySwapReport(
      [swap(), swap({ id: 'outra000', requester_id: 'fabio', target_id: 'ana' })],
      '2026-10'
    );
    expect(report.rows).toHaveLength(2);
    expect(report.peopleCount).toBe(3);
  });

  it('aguenta perfil, equipe e aprovação ausentes', () => {
    const [row] = buildMonthlySwapReport(
      [swap({ requester: null, target: { name: 'Fabio', team: null }, admin_approver: null, admin_approved_at: null })],
      '2026-10'
    ).rows;
    expect(row.requester.name).toBe('-');
    expect(row.target.team).toBe('Sem equipe');
    expect(row.approvedAt).toBe('-');
    expect(row.approvedBy).toBe('-');
  });
});

describe('createMonthlySwapReportDoc', () => {
  const docFor = (total: number) =>
    createMonthlySwapReportDoc(
      buildMonthlySwapReport(
        Array.from({ length: total }, (_, i) => swap({ id: String(i).padStart(8, '0') })),
        '2026-10'
      ),
      { coordinatorName: 'Coordenador Morais' }
    );

  it('cabe numa página com poucas trocas e pagina quando há muitas', () => {
    expect(docFor(1).getNumberOfPages()).toBe(1);
    expect(docFor(60).getNumberOfPages()).toBeGreaterThan(2);
  });
});
