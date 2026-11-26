import { describe, expect, it } from 'vitest';
import {
  buildMonthlyDutyReport,
  describeLeave,
  formatDayList,
  formatExtraHours,
  formatPeriod,
  getTeamCalendarColor,
  type DutyReportExtra,
  type DutyReportGuard,
  type DutyReportInput,
  type DutyReportLeave,
  type DutyReportSwap,
} from './monthlyDutyReport';

/**
 * Cenário da escala em papel de dezembro/2026: 4 equipes em rodízio de 24h,
 * 01/12 = C, 02/12 = D, 03/12 = A, 04/12 = B, 05/12 = C...
 */
const TEAMS = [
  { id: 'A', name: 'Equipe A', color: '#2563eb' },
  { id: 'B', name: 'Equipe B', color: '#10b981' },
  { id: 'C', name: 'Equipe C', color: '#f59e0b' },
  { id: 'D', name: 'Equipe D', color: '#ef4444' },
];

const ROTATION = ['C', 'D', 'A', 'B'];
const SCHEDULES = Array.from({ length: 31 }, (_, i) => ({
  shift_date: `2026-12-${String(i + 1).padStart(2, '0')}`,
  team_id: ROTATION[i % 4],
}));

const guard = (id: string, name: string, team_id: string, extra: Partial<DutyReportGuard> = {}): DutyReportGuard => ({
  id,
  name,
  team_id,
  is_active: true,
  is_shift_chief: false,
  ...extra,
});

const GUARDS: DutyReportGuard[] = [
  guard('oziel', 'Oziel', 'A', { is_shift_chief: true }),
  guard('fabio', 'Fabio', 'A'),
  guard('junior', 'Junior', 'A'),
  guard('verneque', 'Verneque', 'A'),
  guard('flavio', 'Flávio', 'B', { is_shift_chief: true }),
  guard('renato', 'Renato', 'B'),
  guard('elenilson', 'Elenilson', 'B'),
  guard('dinarte', 'Dinarte', 'C', { is_shift_chief: true }),
  guard('ronaldo', 'Ronaldo', 'C'),
  guard('glauber', 'Glauber', 'C'),
  guard('ribeiro', 'C. Ribeiro', 'D', { is_shift_chief: true }),
  guard('elcimar', 'Elcimar', 'D'),
  guard('saiu', 'Ex-servidor', 'D', { is_active: false }),
  guard('coordenador', 'Coordenação', null as unknown as string),
];

/** Flávio cede 24/12 (B) e assume 31/12 do Oziel (A). */
const SWAP: DutyReportSwap = {
  id: 'aaaabbbb-1111-2222-3333-444455556666',
  requester_id: 'flavio',
  target_id: 'oziel',
  requester_shift_date: '2026-12-24',
  target_shift_date: '2026-12-31',
  status: 'APPROVED',
};

const leave = (
  id: string,
  guard_id: string,
  start_date: string,
  end_date: string,
  leave_type: string,
  extra: Partial<DutyReportLeave> = {}
): DutyReportLeave => ({ id, guard_id, start_date, end_date, leave_type, custom_type: null, status: 'APPROVED', ...extra });

const extra = (id: string, guard_id: string, extra_date: string, more: Partial<DutyReportExtra> = {}): DutyReportExtra => ({
  id,
  guard_id,
  extra_date,
  quantity: 24,
  minutes: 0,
  percentage_type: 50,
  justification: 'Cobertura de plantão',
  ...more,
});

const baseInput = (overrides: Partial<DutyReportInput> = {}): DutyReportInput => ({
  monthKey: '2026-12',
  teams: TEAMS,
  guards: GUARDS,
  schedules: SCHEDULES,
  swaps: [SWAP],
  leaves: [
    leave('bh1', 'dinarte', '2026-12-01', '2026-12-01', 'OUTRO', { custom_type: 'Banco de horas' }),
    leave('bh2', 'dinarte', '2026-12-05', '2026-12-05', 'OUTRO', { custom_type: 'Banco de Horas' }),
  ],
  extras: [extra('x1', 'elenilson', '2026-12-01'), extra('x2', 'flavio', '2026-12-05')],
  ...overrides,
});

const day = (report: ReturnType<typeof buildMonthlyDutyReport>, date: string) => report.days.find((d) => d.date === date)!;
const names = (report: ReturnType<typeof buildMonthlyDutyReport>, date: string) => day(report, date).entries.map((e) => e.name);

describe('buildMonthlyDutyReport', () => {
  it('monta todos os dias do mês com a equipe da escala base', () => {
    const report = buildMonthlyDutyReport(baseInput());
    expect(report.monthLabel).toBe('Dezembro de 2026');
    expect(report.days).toHaveLength(31);
    expect(day(report, '2026-12-01').weekdayLabel).toBe('Terça-feira');
    expect(day(report, '2026-12-01').teams.map((t) => t.name)).toEqual(['Equipe C']);
    expect(day(report, '2026-12-03').teams.map((t) => t.name)).toEqual(['Equipe A']);
    expect(report.totals.daysWithTeam).toBe(31);
  });

  it('lista a equipe com o chefe de turno primeiro e o resto em ordem alfabética', () => {
    const report = buildMonthlyDutyReport(baseInput({ leaves: [], extras: [] }));
    expect(names(report, '2026-12-09')).toEqual(['Dinarte', 'Glauber', 'Ronaldo']);
  });

  it('deixa inativos e perfis sem equipe fora da escala', () => {
    const report = buildMonthlyDutyReport(baseInput());
    expect(names(report, '2026-12-02')).toEqual(['C. Ribeiro', 'Elcimar']);
  });

  it('troca aprovada: quem assume ocupa o lugar de quem cedeu, com o protocolo', () => {
    const report = buildMonthlyDutyReport(baseInput());

    // 24/12 é da equipe B: Oziel entra no lugar do Flávio (chefe, 1ª posição).
    const d24 = day(report, '2026-12-24');
    expect(d24.entries.map((e) => e.name)).toEqual(['Oziel', 'Elenilson', 'Renato']);
    expect(d24.entries[0]).toMatchObject({
      status: 'duty',
      swap: { withName: 'Flávio', otherDate: '2026-12-31', protocol: 'TRC-AAAABBBB' },
    });

    // 31/12 é da equipe A: Flávio entra no lugar do Oziel.
    expect(names(report, '2026-12-31')).toEqual(['Flávio', 'Fabio', 'Junior', 'Verneque']);
    expect(day(report, '2026-12-31').entries[0].swap?.withName).toBe('Oziel');
    expect(report.totals.swaps).toBe(1);
  });

  it('ignora trocas que não estão aprovadas', () => {
    const report = buildMonthlyDutyReport(baseInput({ swaps: [{ ...SWAP, status: 'PENDING' }] }));
    expect(names(report, '2026-12-24')).toEqual(['Flávio', 'Elenilson', 'Renato']);
    expect(report.totals.swaps).toBe(0);
  });

  it('folga de banco de horas: a pessoa continua na posição, marcada como ausente, e quem fez extra vai no fim', () => {
    const report = buildMonthlyDutyReport(baseInput());
    const d1 = day(report, '2026-12-01');

    expect(d1.entries.map((e) => [e.name, e.status])).toEqual([
      ['Dinarte', 'absent'],
      ['Glauber', 'duty'],
      ['Ronaldo', 'duty'],
      ['Elenilson', 'extra'],
    ]);
    expect(d1.entries[0].leave).toEqual({ category: 'BANCO_HORAS', code: 'BH', label: 'Banco de horas' });
    expect(d1.entries[3].extra).toEqual({ hours: '24h', percentage: 50, justification: 'Cobertura de plantão' });
    expect(d1.presentCount).toBe(3);
  });

  it('agrupa as folgas de banco de horas por pessoa, como na folha ("Dinarte - 01 e 05/12")', () => {
    const report = buildMonthlyDutyReport(baseInput());
    expect(report.observations.hourBank).toEqual([{ guardId: 'dinarte', name: 'Dinarte', dates: '01 e 05/12' }]);
  });

  it('afastamento de vários dias vale em todos os plantões do período', () => {
    const report = buildMonthlyDutyReport(
      baseInput({ leaves: [leave('at', 'glauber', '2026-12-08', '2026-12-14', 'ATESTADO')], extras: [] })
    );
    expect(day(report, '2026-12-09').entries.find((e) => e.name === 'Glauber')?.status).toBe('absent');
    expect(day(report, '2026-12-13').entries.find((e) => e.name === 'Glauber')?.status).toBe('absent');
    expect(report.observations.medical).toEqual([{ guardId: 'glauber', name: 'Glauber', dates: '09 e 13/12' }]);
    expect(report.totals.absences).toBe(2);
  });

  it('férias aparecem pelo período, mesmo começando no mês anterior', () => {
    const report = buildMonthlyDutyReport(
      baseInput({ leaves: [leave('fer', 'verneque', '2026-11-20', '2026-12-10', 'FERIAS')], extras: [] })
    );
    expect(day(report, '2026-12-03').entries.find((e) => e.name === 'Verneque')?.leave?.code).toBe('FÉRIAS');
    expect(day(report, '2026-12-07').entries.find((e) => e.name === 'Verneque')?.status).toBe('absent');
    expect(day(report, '2026-12-11').entries.find((e) => e.name === 'Verneque')?.status).toBe('duty');
    expect(report.observations.vacation).toEqual([{ guardId: 'verneque', name: 'Verneque', dates: '20/11 a 10/12' }]);
  });

  it('afastamento em dia sem plantão não some calado: vira aviso', () => {
    const report = buildMonthlyDutyReport(
      baseInput({ leaves: [leave('at', 'renato', '2026-12-02', '2026-12-02', 'ATESTADO')], extras: [] })
    );
    expect(report.observations.medical).toEqual([]);
    expect(report.warnings.leavesWithoutShift).toEqual([{ guardName: 'Renato', label: 'Atestado médico', dates: '02/12' }]);
  });

  it('afastamento em plantão assumido por troca marca quem assumiu', () => {
    const report = buildMonthlyDutyReport(
      baseInput({ leaves: [leave('at', 'oziel', '2026-12-24', '2026-12-24', 'ATESTADO')], extras: [] })
    );
    const oziel = day(report, '2026-12-24').entries.find((e) => e.name === 'Oziel')!;
    expect(oziel.status).toBe('absent');
    expect(oziel.swap?.withName).toBe('Flávio');
  });

  it('TRE pendente não tira ninguém da escala, mas gera aviso', () => {
    const report = buildMonthlyDutyReport(
      baseInput({
        leaves: [leave('tre', 'ronaldo', '2026-12-09', '2026-12-09', 'TRE', { status: 'PENDING' })],
        extras: [],
      })
    );
    expect(day(report, '2026-12-09').entries.find((e) => e.name === 'Ronaldo')?.status).toBe('duty');
    expect(report.warnings.pendingTre).toEqual([{ guardName: 'Ronaldo', dates: '09/12' }]);
    expect(report.observations.tre).toEqual([]);
  });

  it('TRE recusado é ignorado', () => {
    const report = buildMonthlyDutyReport(
      baseInput({ leaves: [leave('tre', 'ronaldo', '2026-12-09', '2026-12-09', 'TRE', { status: 'REJECTED' })] })
    );
    expect(day(report, '2026-12-09').entries.find((e) => e.name === 'Ronaldo')?.status).toBe('duty');
    expect(report.warnings.pendingTre).toEqual([]);
  });

  it('extra no próprio plantão marca a pessoa em vez de duplicar', () => {
    const report = buildMonthlyDutyReport(baseInput({ leaves: [], extras: [extra('x', 'glauber', '2026-12-09', { quantity: 6, minutes: 30 })] }));
    const entries = day(report, '2026-12-09').entries;
    expect(entries.filter((e) => e.name === 'Glauber')).toHaveLength(1);
    expect(entries.find((e) => e.name === 'Glauber')).toMatchObject({ status: 'duty', extra: { hours: '6h30' } });
    expect(report.totals.extras).toBe(1);
  });

  it('soma lançamentos de extra da mesma pessoa no mesmo dia', () => {
    const report = buildMonthlyDutyReport(
      baseInput({
        leaves: [],
        extras: [
          extra('x1', 'elenilson', '2026-12-01', { quantity: 12, justification: 'Evento' }),
          extra('x2', 'elenilson', '2026-12-01', { quantity: 6, minutes: 15, justification: 'Cobertura' }),
        ],
      })
    );
    const extras = day(report, '2026-12-01').entries.filter((e) => e.status === 'extra');
    expect(extras).toHaveLength(1);
    expect(extras[0].extra).toEqual({ hours: '18h15', percentage: 50, justification: 'Evento; Cobertura' });
  });

  it('avisa os dias sem equipe cadastrada', () => {
    const report = buildMonthlyDutyReport(
      baseInput({ schedules: SCHEDULES.filter((s) => s.shift_date !== '2026-12-25') })
    );
    expect(report.warnings.daysWithoutTeam).toEqual(['2026-12-25']);
    expect(day(report, '2026-12-25').entries).toEqual([]);
  });

  it('monta as semanas de domingo a sábado', () => {
    const report = buildMonthlyDutyReport(baseInput());
    expect(report.weeks).toHaveLength(5);
    expect(report.weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(report.weeks[0][2]?.date).toBe('2026-12-01');
    expect(report.weeks[4].map((d) => d?.dayOfMonth ?? null)).toEqual([27, 28, 29, 30, 31, null, null]);
    expect(report.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('fevereiro que começa no domingo cabe em 4 semanas', () => {
    const report = buildMonthlyDutyReport(baseInput({ monthKey: '2026-02', schedules: [], swaps: [], leaves: [], extras: [] }));
    expect(report.days).toHaveLength(28);
    expect(report.weeks).toHaveLength(4);
    expect(report.weeks[0][0]?.date).toBe('2026-02-01');
  });
});

describe('formatação', () => {
  it('formatDayList', () => {
    expect(formatDayList(['2026-12-05', '2026-12-01'])).toBe('01 e 05/12');
    expect(formatDayList(['2026-12-01', '2026-12-05', '2026-12-09'])).toBe('01, 05 e 09/12');
    expect(formatDayList(['2026-12-09'])).toBe('09/12');
    expect(formatDayList(['2026-12-09', '2026-12-09'])).toBe('09/12');
    expect(formatDayList([])).toBe('');
  });

  it('formatPeriod', () => {
    expect(formatPeriod('2026-12-01', '2026-12-15')).toBe('01/12 a 15/12');
    expect(formatPeriod('2026-12-01', '2026-12-01')).toBe('01/12');
  });

  it('formatExtraHours', () => {
    expect(formatExtraHours(12, 0)).toBe('12h');
    expect(formatExtraHours(6, 30)).toBe('6h30');
    expect(formatExtraHours(0, 45)).toBe('0h45');
    expect(formatExtraHours(1, 75)).toBe('2h15');
  });

  it('describeLeave', () => {
    expect(describeLeave('OUTRO', 'BH').code).toBe('BH');
    expect(describeLeave('ATESTADO', null)).toEqual({ category: 'ATESTADO', code: 'ATESTADO', label: 'Atestado médico' });
    expect(describeLeave('FALTA_INJUSTIFICADA', null).category).toBe('OUTRO');
    expect(describeLeave('OUTRO', 'Audiência')).toEqual({ category: 'OUTRO', code: 'AUDIÊNCIA', label: 'Audiência' });
    expect(describeLeave('OUTRO', 'Curso de capacitação').code).toBe('CURSO');
    expect(describeLeave('OUTRO', 'Dispensa-médica').code).toBe('DISPENSA.');
    expect(describeLeave('OUTRO', null).label).toBe('Afastamento');
  });

  it('getTeamCalendarColor', () => {
    expect(getTeamCalendarColor('Equipe A', '#000')).toBe('#3b82f6');
    expect(getTeamCalendarColor('d', null)).toBe('#ef4444');
    expect(getTeamCalendarColor('Noturna', '#123456')).toBe('#123456');
    expect(getTeamCalendarColor(null, null)).toBe('#64748b');
  });
});
