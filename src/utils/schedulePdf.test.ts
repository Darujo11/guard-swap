import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  describe as describeDay,
  resolveDays,
  type GuardScheduleReport,
} from './schedulePdf';

/** Agosto/2026: Fabio cede 01/08 ao Reginaldo e assume 06/08 no lugar. */
const RELATORIO: GuardScheduleReport = {
  guardName: 'Fabio Ventura',
  teamName: 'Equipe A',
  monthStart: '2026-08-01',
  monthLabel: 'agosto 2026',
  days: [
    {
      date: '2026-08-01',
      teamName: 'Equipe A',
      isSwapped: false,
      isGivenAway: true,
      counterpartName: 'Reginaldo Ferreira',
      exchangeDate: '2026-08-06',
      swapProtocol: 'TRC-AAAABBBB',
    },
    { date: '2026-08-03', teamName: 'Equipe A', isSwapped: false, isGivenAway: false },
    { date: '2026-08-05', teamName: 'Equipe A', isSwapped: false, isGivenAway: false },
    {
      date: '2026-08-06',
      teamName: 'Equipe A',
      isSwapped: true,
      isGivenAway: false,
      counterpartName: 'Reginaldo Ferreira',
      counterpartTeamName: 'Equipe B',
      exchangeDate: '2026-08-01',
      swapProtocol: 'TRC-AAAABBBB',
    },
    { date: '2026-08-07', teamName: 'Equipe A', isSwapped: false, isGivenAway: false },
  ],
  extras: [
    { date: '2026-08-05', justification: 'Cobertura de evento', percentageType: 50 },
    { date: '2026-08-09', justification: 'Reforço de portaria', percentageType: 100 },
  ],
  leaves: [{ date: '2026-08-07', label: 'TRE' }],
};

const resolved = resolveDays(RELATORIO);

describe('resolveDays', () => {
  it('classifica o dia cedido como "given-away", nunca como plantão', () => {
    expect(resolved.get('2026-08-01')?.kind).toBe('given-away');
  });

  it('classifica o dia assumido como troca', () => {
    expect(resolved.get('2026-08-06')?.kind).toBe('swap');
  });

  it('afastamento tem precedência sobre o plantão do mesmo dia', () => {
    expect(resolved.get('2026-08-07')?.kind).toBe('leave');
    expect(resolved.get('2026-08-07')?.day).toBeDefined();
  });

  it('extra sobre um plantão não descaracteriza o plantão', () => {
    const dia = resolved.get('2026-08-05');
    expect(dia?.kind).toBe('shift');
    expect(dia?.extra?.percentageType).toBe(50);
  });

  it('extra em dia sem plantão vira uma linha própria', () => {
    expect(resolved.get('2026-08-09')?.kind).toBe('extra');
  });
});

describe('computeTotals', () => {
  const totais = computeTotals(resolved);

  it('não conta o plantão cedido como trabalhado', () => {
    // Dias: 01 cedido, 03 e 05 plantão, 06 troca, 07 afastamento.
    expect(totais.shifts).toBe(3);
    expect(totais.givenAway).toBe(1);
  });

  it('conta a troca também como plantão trabalhado', () => {
    expect(totais.swaps).toBe(1);
  });

  it('não conta o dia de afastamento como plantão trabalhado', () => {
    expect(totais.leaves).toBe(1);
  });

  it('conta os extras independentemente de haver plantão no dia', () => {
    expect(totais.extras).toBe(2);
  });

  it('zera com segurança num relatório vazio', () => {
    const vazio = computeTotals(
      resolveDays({ ...RELATORIO, days: [], extras: [], leaves: [] })
    );
    expect(vazio).toEqual({ shifts: 0, swaps: 0, extras: 0, givenAway: 0, leaves: 0 });
  });
});

describe('describe', () => {
  it('no dia cedido diz para quem foi, o que recebeu em troca e o protocolo', () => {
    const texto = describeDay(resolved.get('2026-08-01')!);

    expect(texto).toContain('cedido a Reginaldo Ferreira');
    expect(texto).toContain('assumiu 06/08 em troca');
    expect(texto).toContain('TRC-AAAABBBB');
  });

  it('no dia assumido diz de quem é o plantão, a equipe coberta e o protocolo', () => {
    const texto = describeDay(resolved.get('2026-08-06')!);

    expect(texto).toContain('Assumiu plantão de Reginaldo Ferreira');
    expect(texto).toContain('(Equipe B)');
    expect(texto).toContain('cedeu 01/08');
    expect(texto).toContain('TRC-AAAABBBB');
  });

  it('não usa travessão, que a codificação padrão do jsPDF não imprime', () => {
    const textos = [...resolved.values()].map(describeDay);

    expect(textos.some(t => t.includes('—'))).toBe(false);
  });

  it('descreve o extra com percentual e justificativa', () => {
    expect(describeDay(resolved.get('2026-08-09')!)).toBe('Extra 100%: Reforço de portaria');
  });

  it('devolve string vazia para um plantão comum', () => {
    expect(describeDay(resolved.get('2026-08-03')!)).toBe('');
  });
});
