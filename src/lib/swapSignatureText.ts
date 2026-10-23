/**
 * Textos da assinatura eletrônica das trocas, sem dependência do client do Supabase (usados também
 * pelo comprovante impresso, que é testado fora do navegador).
 */

export type SwapSignatureAction = 'SOLICITOU' | 'ACEITOU' | 'RECUSOU' | 'CANCELOU' | 'APROVOU' | 'REJEITOU';
export type SwapSignerRole = 'solicitante' | 'colega' | 'coordenacao';

/** Mesmo texto que o banco grava em swap_signatures.declaration (função swap_signature_declaration). */
export const SWAP_SIGNATURE_DECLARATIONS: Record<SwapSignatureAction, string> = {
  SOLICITOU: 'Declaro que solicito a troca de plantão nos termos acima.',
  ACEITOU: 'Declaro que li e aceito a troca de plantão nos termos acima.',
  RECUSOU: 'Declaro que recuso a troca de plantão nos termos acima.',
  CANCELOU: 'Declaro que cancelo a minha solicitação de troca de plantão.',
  APROVOU: 'Na qualidade de coordenação, aprovo a troca de plantão nos termos acima.',
  REJEITOU: 'Na qualidade de coordenação, rejeito a troca de plantão nos termos acima.',
};

export const SWAP_SIGNATURE_ACTION_LABELS: Record<SwapSignatureAction, string> = {
  SOLICITOU: 'Solicitou',
  ACEITOU: 'Aceitou',
  RECUSOU: 'Recusou',
  CANCELOU: 'Cancelou',
  APROVOU: 'Aprovou',
  REJEITOU: 'Rejeitou',
};

export const SWAP_SIGNER_ROLE_LABELS: Record<SwapSignerRole, string> = {
  solicitante: 'Solicitante',
  colega: 'Colega da troca',
  coordenacao: 'Coordenação',
};
