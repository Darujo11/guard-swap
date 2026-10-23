import { describe, expect, it } from 'vitest';
import { groupSwapsByMonth } from './swapMonthGroups';

const ME = 'eu';
const TODAY = new Date(2026, 9, 23); // 23/10/2026

const swap = (id: string, requesterDate: string, targetDate: string, status = 'APPROVED', target = 'outro') => ({
  id,
  requester_shift_date: requesterDate,
  target_shift_date: targetDate,
  status,
  target_id: target,
});

describe('groupSwapsByMonth', () => {
  it('separa o mês atual dos demais, mais recente primeiro', () => {
    const g = groupSwapsByMonth(
      [swap('a', '2026-10-01', '2026-10-20'), swap('b', '2026-09-03', '2026-09-10'), swap('c', '2026-11-05', '2026-11-12')],
      ME,
      TODAY
    );
    expect(g.currentMonthKey).toBe('2026-10');
    expect(g.groupedByMonth['2026-10'].map((s) => s.id)).toEqual(['a']);
    expect(g.otherMonthKeys).toEqual(['2026-11', '2026-09']);
    expect(g.otherMonthsRequests.map((s) => s.id).sort()).toEqual(['b', 'c']);
  });

  it('troca entre dois meses aparece nos dois, mas conta uma vez só em "outros meses"', () => {
    const g = groupSwapsByMonth([swap('x', '2026-11-28', '2026-12-03')], ME, TODAY);
    expect(g.otherMonthKeys).toEqual(['2026-12', '2026-11']);
    expect(g.otherMonthsRequests).toHaveLength(1);
  });

  it('troca que toca o mês atual não é contada de novo em "outros meses"', () => {
    const g = groupSwapsByMonth([swap('y', '2026-10-30', '2026-11-04')], ME, TODAY);
    expect(g.groupedByMonth['2026-10'].map((s) => s.id)).toEqual(['y']);
    expect(g.otherMonthKeys).toEqual(['2026-11']);
    expect(g.otherMonthsRequests).toHaveLength(0);
  });

  it('conta os pedidos de outros meses que esperam a minha resposta', () => {
    const g = groupSwapsByMonth(
      [
        swap('p1', '2026-11-05', '2026-11-12', 'PENDING', ME), // pediram para mim: aguardando
        swap('p2', '2026-11-06', '2026-11-13', 'PENDING', 'outro'), // eu pedi: não depende de mim
        swap('p3', '2026-12-01', '2026-12-08', 'ACCEPTED', ME), // já respondi
        swap('p4', '2026-10-15', '2026-10-22', 'PENDING', ME), // mês atual: já está à mostra
      ],
      ME,
      TODAY
    );
    expect(g.otherMonthsAwaitingMe).toBe(1);
  });

  it('sem trocas no mês atual, tudo vai para "outros meses"', () => {
    const g = groupSwapsByMonth([swap('z', '2026-08-01', '2026-08-09')], ME, TODAY);
    expect(g.groupedByMonth['2026-10']).toBeUndefined();
    expect(g.otherMonthKeys).toEqual(['2026-08']);
  });

  it('lista vazia', () => {
    const g = groupSwapsByMonth([], ME, TODAY);
    expect(g.sortedMonthKeys).toEqual([]);
    expect(g.otherMonthsAwaitingMe).toBe(0);
  });
});
