// Regras compartilhadas das decisões de TRE (recusa pelo painel e reversão em Afastamentos).
import { format } from 'date-fns';

/** Motivo obrigatório ao recusar ou reverter um TRE: fica nas observações e na auditoria. */
export const TRE_REASON_MIN_LENGTH = 10;

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  PENDING: 'Pendente',
};

export const isValidTreReason = (reason: string) => reason.trim().length >= TRE_REASON_MIN_LENGTH;

/**
 * Acrescenta a linha da decisão às observações existentes, sem apagar o que já havia.
 * Ex.: "Recusado em 04/11/2026 por Fulano: motivo".
 */
export function appendTreDecisionNote(
  currentNotes: string | null | undefined,
  action: string,
  adminName: string,
  reason: string,
  when: Date = new Date(),
): string {
  const entry = `${action} em ${format(when, 'dd/MM/yyyy')} por ${adminName}: ${reason.trim()}`;
  return currentNotes?.trim() ? `${currentNotes.trim()}\n${entry}` : entry;
}
