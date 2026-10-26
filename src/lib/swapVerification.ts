/**
 * Verificação de autenticidade do comprovante de troca (docs/assinatura-eletronica.md).
 * A conferência é feita pelo banco em verify_swap_document(código), a mesma RPC da página
 * pública /#/verificar/<código>; aqui ficam o tipo da resposta e a leitura do código digitado.
 */
import type { SwapStatus } from '@/lib/types';

/** Resposta de verify_swap_document (dados mínimos: primeiro nome e inicial do sobrenome). */
export interface SwapVerificationResult {
  found: boolean;
  code?: string;
  protocol?: string;
  requester?: string | null;
  target?: string | null;
  requester_shift_date?: string;
  target_shift_date?: string;
  swap_exists?: boolean;
  status?: SwapStatus | null;
  terms_match?: boolean;
  signatures?: { action: string; role: string; name: string | null; signed_at: string }[];
}

/**
 * Normaliza o que foi digitado ou colado para o formato XXXXX-XXXXX.
 * Aceita o código com ou sem hífen e também o link inteiro do comprovante
 * (https://escalasmart.com.br/#/verificar/57D25-9674C): só o trecho depois da última barra conta,
 * senão as letras do domínio entrariam no código.
 */
export function normalizeVerificationCode(value: string): string {
  const lastSegment = value.trim().replace(/\/+$/, '').split('/').pop() ?? '';
  const hex = lastSegment.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 10);
  return hex.length > 5 ? `${hex.slice(0, 5)}-${hex.slice(5)}` : hex;
}

export const isCompleteVerificationCode = (code: string) => /^[0-9A-F]{5}-[0-9A-F]{5}$/.test(code);
