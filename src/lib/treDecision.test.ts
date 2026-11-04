import { describe, expect, it } from 'vitest';
import { appendTreDecisionNote, isValidTreReason, TRE_REASON_MIN_LENGTH } from './treDecision';

const when = new Date(2026, 10, 4, 12, 0);

describe('appendTreDecisionNote', () => {
  it('acrescenta a decisão depois das observações existentes', () => {
    expect(appendTreDecisionNote('Solicitado pelo segurança', 'Recusado', 'Coordenação', ' sem comprovante do TRE ', when))
      .toBe('Solicitado pelo segurança\nRecusado em 04/11/2026 por Coordenação: sem comprovante do TRE');
  });

  it('cria a observação quando não havia nenhuma', () => {
    expect(appendTreDecisionNote(null, 'Recusado', 'Coordenação', 'sem comprovante do TRE', when))
      .toBe('Recusado em 04/11/2026 por Coordenação: sem comprovante do TRE');
    expect(appendTreDecisionNote('   ', 'Recusado', 'Coordenação', 'sem comprovante do TRE', when))
      .toBe('Recusado em 04/11/2026 por Coordenação: sem comprovante do TRE');
  });
});

describe('isValidTreReason', () => {
  it(`exige ao menos ${TRE_REASON_MIN_LENGTH} caracteres sem contar espaços nas pontas`, () => {
    expect(isValidTreReason('curto')).toBe(false);
    expect(isValidTreReason('          a')).toBe(false);
    expect(isValidTreReason('sem comprovante')).toBe(true);
  });
});
