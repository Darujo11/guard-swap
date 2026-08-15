import { describe, expect, it } from 'vitest';
import {
  computeEffectiveSchedule,
  formatSwapProtocol,
  getEffectiveDatesSet,
  getWorkedDays,
} from './effectiveSchedule';

/**
 * Cenário base: escala 12x36 de agosto/2026.
 * Fabio é da Equipe A (dias ímpares), Reginaldo é da Equipe B (dias pares).
 */
const TEAMS = [
  { id: 'A', name: 'Equipe A', color: '#2563eb' },
  { id: 'B', name: 'Equipe B', color: '#10b981' },
];

const BASE_SCHEDULES = [
  { shift_date: '2026-08-01', team_id: 'A' },
  { shift_date: '2026-08-03', team_id: 'A' },
  { shift_date: '2026-08-05', team_id: 'A' },
  { shift_date: '2026-08-02', team_id: 'B' },
  { shift_date: '2026-08-04', team_id: 'B' },
  { shift_date: '2026-08-06', team_id: 'B' },
];

/** Fabio cede 01/08 e assume 06/08 do Reginaldo. */
const SWAP_FABIO_REGINALDO = {
  id: 'aaaabbbb-cccc-dddd-eeee-ffff00001111',
  requester_id: 'fabio',
  target_id: 'reginaldo',
  requester_shift_date: '2026-08-01',
  target_shift_date: '2026-08-06',
  requester: { team_id: 'A', name: 'Fabio Ventura' },
  target: { team_id: 'B', name: 'Reginaldo Ferreira' },
};

const scheduleFor = (guardId: string, teamId: string, swaps = [SWAP_FABIO_REGINALDO]) =>
  computeEffectiveSchedule(
    BASE_SCHEDULES,
    swaps,
    guardId,
    teamId,
    TEAMS.find(t => t.id === teamId)!.color,
    TEAMS.find(t => t.id === teamId)!.name,
    TEAMS
  );

const sortedDates = (dates: Iterable<string>) => [...dates].sort();

describe('formatSwapProtocol', () => {
  it('deriva o protocolo dos 8 primeiros caracteres do id, como a tela de trocas', () => {
    expect(formatSwapProtocol('aaaabbbb-cccc-dddd')).toBe('TRC-AAAABBBB');
  });
});

describe('computeEffectiveSchedule', () => {
  it('marca o dia cedido como isGivenAway, não como plantão trabalhado', () => {
    const days = scheduleFor('fabio', 'A');
    const cedido = days.get('2026-08-01');

    expect(cedido?.isGivenAway).toBe(true);
    expect(cedido?.isSwapped).toBe(false);
    expect(cedido?.coveredByName).toBe('Reginaldo Ferreira');
    expect(cedido?.exchangedForDate).toBe('2026-08-06');
    expect(cedido?.swapProtocol).toBe('TRC-AAAABBBB');
  });

  it('marca o dia assumido com a equipe coberta e o dono original', () => {
    const assumido = scheduleFor('fabio', 'A').get('2026-08-06');

    expect(assumido?.isSwapped).toBe(true);
    expect(assumido?.isGivenAway).toBeUndefined();
    expect(assumido?.originalOwnerName).toBe('Reginaldo Ferreira');
    expect(assumido?.originalTeamName).toBe('Equipe B');
    expect(assumido?.originalDate).toBe('2026-08-01');
    expect(assumido?.swapProtocol).toBe('TRC-AAAABBBB');
  });

  it('aplica a troca de forma simétrica para o outro lado', () => {
    const days = scheduleFor('reginaldo', 'B');

    expect(days.get('2026-08-06')?.isGivenAway).toBe(true);
    expect(days.get('2026-08-06')?.coveredByName).toBe('Fabio Ventura');
    expect(days.get('2026-08-01')?.isSwapped).toBe(true);
    expect(days.get('2026-08-01')?.originalTeamName).toBe('Equipe A');
  });

  it('não altera a escala de quem não participou da troca', () => {
    const days = scheduleFor('terceiro', 'A');

    expect(sortedDates(days.keys())).toEqual(['2026-08-01', '2026-08-03', '2026-08-05']);
    expect([...days.values()].every(d => !d.isSwapped && !d.isGivenAway)).toBe(true);
  });

  it('não vaza os dias das outras equipes para a escala do profissional', () => {
    const days = computeEffectiveSchedule(BASE_SCHEDULES, [], 'fabio', 'A', '#000', 'Equipe A', TEAMS);

    expect(sortedDates(days.keys())).toEqual(['2026-08-01', '2026-08-03', '2026-08-05']);
  });

  it('independe da ordem em que as trocas chegam do banco', () => {
    // Fabio também cede 05/08 e assume 01/08 de volta de um terceiro.
    const segundaTroca = {
      id: 'bbbbcccc-dddd',
      requester_id: 'fabio',
      target_id: 'carlos',
      requester_shift_date: '2026-08-05',
      target_shift_date: '2026-08-01',
      requester: { team_id: 'A', name: 'Fabio Ventura' },
      target: { team_id: 'B', name: 'Carlos' },
    };
    const swaps = [SWAP_FABIO_REGINALDO, segundaTroca];

    const direta = scheduleFor('fabio', 'A', swaps);
    const inversa = scheduleFor('fabio', 'A', [...swaps].reverse());

    const trabalhados = (days: ReturnType<typeof scheduleFor>) =>
      sortedDates(getWorkedDays(days).keys());

    expect(trabalhados(direta)).toEqual(trabalhados(inversa));
    // 01/08 foi cedido numa troca e reassumido na outra: prevalece o trabalhado.
    expect(direta.get('2026-08-01')?.isSwapped).toBe(true);
    expect(direta.get('2026-08-01')?.isGivenAway).toBeUndefined();
  });

  it('tolera trocas sem os perfis carregados, sem derrubar o cálculo', () => {
    const semPerfis = { ...SWAP_FABIO_REGINALDO, requester: null, target: null };
    const days = scheduleFor('fabio', 'A', [semPerfis]);

    expect(days.get('2026-08-01')?.isGivenAway).toBe(true);
    expect(days.get('2026-08-01')?.coveredByName).toBeUndefined();
    expect(days.get('2026-08-06')?.isSwapped).toBe(true);
    // Sem a equipe do colega, cai na cor da própria equipe em vez de quebrar.
    expect(days.get('2026-08-06')?.originalTeamColor).toBe('#2563eb');
  });
});

describe('getWorkedDays', () => {
  it('remove os plantões cedidos e preserva os assumidos', () => {
    const trabalhados = getWorkedDays(scheduleFor('fabio', 'A'));

    expect(sortedDates(trabalhados.keys())).toEqual([
      '2026-08-03',
      '2026-08-05',
      '2026-08-06',
    ]);
    expect(trabalhados.has('2026-08-01')).toBe(false);
  });

  it('mantém a contagem coerente: um dia cedido troca de dono, não some', () => {
    const fabio = getWorkedDays(scheduleFor('fabio', 'A')).size;
    const reginaldo = getWorkedDays(scheduleFor('reginaldo', 'B')).size;

    expect(fabio).toBe(3);
    expect(reginaldo).toBe(3);
  });
});

describe('getEffectiveDatesSet', () => {
  it('espelha o resultado de computeEffectiveSchedule + getWorkedDays', () => {
    const viaSet = sortedDates(
      getEffectiveDatesSet(BASE_SCHEDULES, [SWAP_FABIO_REGINALDO], 'fabio', 'A')
    );
    const viaMapa = sortedDates(getWorkedDays(scheduleFor('fabio', 'A')).keys());

    expect(viaSet).toEqual(viaMapa);
  });

  it('aplica a troca para o lado alvo', () => {
    const dates = getEffectiveDatesSet(BASE_SCHEDULES, [SWAP_FABIO_REGINALDO], 'reginaldo', 'B');

    expect(sortedDates(dates)).toEqual(['2026-08-01', '2026-08-02', '2026-08-04']);
  });

  it('independe da ordem das trocas', () => {
    const segundaTroca = {
      requester_id: 'fabio',
      target_id: 'carlos',
      requester_shift_date: '2026-08-05',
      target_shift_date: '2026-08-01',
    };
    const swaps = [SWAP_FABIO_REGINALDO, segundaTroca];

    const direta = sortedDates(getEffectiveDatesSet(BASE_SCHEDULES, swaps, 'fabio', 'A'));
    const inversa = sortedDates(
      getEffectiveDatesSet(BASE_SCHEDULES, [...swaps].reverse(), 'fabio', 'A')
    );

    expect(direta).toEqual(inversa);
    expect(direta).toEqual(['2026-08-01', '2026-08-03', '2026-08-06']);
  });

  it('devolve conjunto vazio quando a equipe não tem escala cadastrada', () => {
    expect(getEffectiveDatesSet([], [], 'fabio', 'A').size).toBe(0);
  });
});
