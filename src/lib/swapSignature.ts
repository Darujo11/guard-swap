import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

/**
 * Assinatura eletrônica dos atos de troca de plantão.
 *
 * O banco (migration 20261023150000_swap_signatures) só aceita solicitar/aceitar/recusar/cancelar/
 * aprovar/rejeitar uma troca se o JWT da requisição mostrar senha digitada há no máximo 5 minutos
 * (claim `amr`), e grava a assinatura sozinho. Aqui a senha é confirmada numa sessão DESCARTÁVEL,
 * separada da sessão do app: assim o login principal (e o onAuthStateChange do useAuth) não é tocado.
 */

export {
  SWAP_SIGNATURE_ACTION_LABELS,
  SWAP_SIGNATURE_DECLARATIONS,
  type SwapSignatureAction,
} from '@/lib/swapSignatureText';

/** Erro já com mensagem pronta para o usuário. */
export class SignatureError extends Error {}

export type SigningClient = SupabaseClient<Database>;

/**
 * Confirma a senha de quem está logado e executa `run` com um client autenticado por essa
 * confirmação (é ele que precisa fazer o insert/update na troca). A sessão descartável é
 * encerrada no fim, dê certo ou não.
 */
export async function signSwapAction<T>(password: string, run: (client: SigningClient) => PromiseLike<T>): Promise<T> {
  if (!password) throw new SignatureError('Digite sua senha para assinar.');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new SignatureError('Sua sessão expirou. Entre novamente para assinar.');

  const signer = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'escala-smart-assinatura',
    },
  });

  const credentials = user.email ? { email: user.email, password } : { phone: user.phone ?? '', password };
  const { data, error } = await signer.auth.signInWithPassword(credentials);

  if (error || !data.user) {
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('rate limit') || msg.includes('too many')) {
      throw new SignatureError('Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.');
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      throw new SignatureError('Falha de conexão. Verifique sua internet e tente de novo.');
    }
    throw new SignatureError('Senha incorreta. A ação não foi assinada.');
  }

  try {
    if (data.user.id !== user.id) {
      throw new SignatureError('A senha confirmada não pertence ao usuário logado.');
    }
    return await run(signer);
  } finally {
    await signer.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}

/**
 * Mensagem amigável para erros da assinatura (inclusive os que o banco devolve), ou null se o erro
 * não for desse tipo.
 */
export function describeSignatureError(error: unknown): string | null {
  if (error instanceof SignatureError) return error.message;
  const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message ?? '';
  if (message.includes('ASSINATURA_REQUER_SENHA')) {
    return 'Esta ação precisa ser assinada com sua senha. Recarregue a página e tente de novo.';
  }
  if (message.includes('TERMOS_CONGELADOS')) {
    return 'Depois de solicitada, a troca não pode ter datas, pessoas ou motivo alterados.';
  }
  return null;
}
