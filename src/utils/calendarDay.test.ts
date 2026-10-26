import { describe, expect, it } from 'vitest';
import { CALENDAR_COLORS, describeCalendarDay, isHourBankLeave } from './calendarDay';
import type { EffectiveDay } from './effectiveSchedule';

const SHIFT: EffectiveDay = {
  date: '2026-10-24',
  teamId: 'A',
  teamColor: '#2563eb',
  teamName: 'Equipe A',
  isSwapped: false,
};

/** Caso real: plantão de 24/10 cedido numa troca e, no mesmo dia, um extra. */
const GIVEN_AWAY: EffectiveDay = {
  ...SHIFT,
  isGivenAway: true,
  coveredByName: 'Colega Teste',
  exchangedForDate: '2026-10-27',
  swapId: 'aaaabbbb-0000',
  swapProtocol: 'TRC-AAAABBBB',
};

const EXTRA = { justification: 'Evento na Câmara', percentage_type: 50 };

describe('isHourBankLeave', () => {
  it('reconhece banco de horas cadastrado como "Outro"', () => {
    expect(isHourBankLeave('OUTRO', 'Banco de horas')).toBe(true);
    expect(isHourBankLeave('OUTRO', '  BANCO DE HORAS ')).toBe(true);
    expect(isHourBankLeave('OUTRO', 'Banco de Hora')).toBe(true);
    expect(isHourBankLeave('OUTRO', 'Folga banco de horas')).toBe(true);
    expect(isHourBankLeave('OUTRO', 'BH')).toBe(true);
    expect(isHourBankLeave('BANCO_HORAS', null)).toBe(true);
  });

  it('não confunde com outros afastamentos', () => {
    expect(isHourBankLeave('ATESTADO', null)).toBe(false);
    expect(isHourBankLeave('FALTA_INJUSTIFICADA', null)).toBe(false);
    expect(isHourBankLeave('OUTRO', 'Curso')).toBe(false);
    expect(isHourBankLeave('OUTRO', null)).toBe(false);
  });
});

describe('describeCalendarDay', () => {
  it('plantão cedido com extra no mesmo dia fica metade cinza, metade dourado', () => {
    const view = describeCalendarDay(GIVEN_AWAY, EXTRA, undefined);
    expect(view.isSplitExtra).toBe(true);
    expect(view.style?.background).toBe(
      `linear-gradient(135deg, ${CALENDAR_COLORS.off} 50%, ${CALENDAR_COLORS.extra} 50%)`,
    );
    expect(view.details.join(' ')).toContain('cedido para Colega Teste');
    expect(view.details.join(' ')).toContain('Fez extra neste dia (50%): Evento na Câmara.');
    expect(view.details.join(' ')).toContain('Metade cinza: plantão cedido na troca. Metade dourada: extra.');
    expect(view.details.join(' ')).toContain('TRC-AAAABBBB');
  });

  it('plantão cedido sem extra continua cinza inteiro', () => {
    const view = describeCalendarDay(GIVEN_AWAY, undefined, undefined);
    expect(view.isSplitExtra).toBe(false);
    expect(view.style?.background).toBe(CALENDAR_COLORS.off);
    expect(view.textClass).toContain('text-gray-800');
  });

  it('banco de horas fica cinza, não vermelho', () => {
    const view = describeCalendarDay(SHIFT, undefined, { label: 'Banco de horas', isHourBank: true });
    expect(view.style?.background).toBe(CALENDAR_COLORS.off);
    expect(view.details[0]).toBe('Banco de horas: folga, não conta como plantão trabalhado.');
  });

  it('afastamento continua vermelho', () => {
    const view = describeCalendarDay(SHIFT, undefined, { label: 'Atestado', isHourBank: false });
    expect(view.style?.background).toBe(CALENDAR_COLORS.leave);
    expect(view.textClass).toContain('text-white');
  });

  it('extra em plantão trabalhado mantém a faixa dourada no canto', () => {
    const view = describeCalendarDay(SHIFT, EXTRA, undefined);
    expect(view.isSplitExtra).toBe(false);
    expect(view.style?.background).toBe(`linear-gradient(135deg, #2563eb 70%, ${CALENDAR_COLORS.extra} 30%)`);
  });

  it('extra avulso em dia sem plantão é dourado inteiro', () => {
    const view = describeCalendarDay(undefined, EXTRA, undefined);
    expect(view.style?.background).toBe(CALENDAR_COLORS.extra);
  });

  it('dia vazio não tem tooltip', () => {
    expect(describeCalendarDay(undefined, undefined, undefined).details).toEqual([]);
  });
});
