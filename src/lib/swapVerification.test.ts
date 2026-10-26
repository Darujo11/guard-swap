import { describe, expect, it } from 'vitest';
import { isCompleteVerificationCode, normalizeVerificationCode } from './swapVerification';

describe('normalizeVerificationCode', () => {
  it('formata o código digitado', () => {
    expect(normalizeVerificationCode('57d259674c')).toBe('57D25-9674C');
    expect(normalizeVerificationCode('57D25-9674C')).toBe('57D25-9674C');
    expect(normalizeVerificationCode(' 57d25 9674c ')).toBe('57D25-9674C');
  });

  it('aceita o link do comprovante colado inteiro', () => {
    expect(normalizeVerificationCode('https://escalasmart.com.br/#/verificar/57D25-9674C')).toBe('57D25-9674C');
    expect(normalizeVerificationCode('escalasmart.com.br/#/verificar/57d25-9674c/')).toBe('57D25-9674C');
  });

  it('mantém a digitação parcial', () => {
    expect(normalizeVerificationCode('57D2')).toBe('57D2');
    expect(normalizeVerificationCode('57D259')).toBe('57D25-9');
    expect(normalizeVerificationCode('')).toBe('');
  });

  it('corta o excesso e ignora caracteres fora do código', () => {
    expect(normalizeVerificationCode('57D25-9674C-FFFF')).toBe('57D25-9674C');
    expect(normalizeVerificationCode('ZZ57D25-9674C')).toBe('57D25-9674C');
  });
});

describe('isCompleteVerificationCode', () => {
  it('exige 10 caracteres no formato XXXXX-XXXXX', () => {
    expect(isCompleteVerificationCode('57D25-9674C')).toBe(true);
    expect(isCompleteVerificationCode('57D25-9674')).toBe(false);
    expect(isCompleteVerificationCode('57D259674C')).toBe(false);
  });
});
