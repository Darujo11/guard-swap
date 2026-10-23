import { beforeEach, describe, expect, it, vi } from 'vitest';

// O client real usa localStorage (indisponível no node): substituído por um falso com getUser.
const mainGetUser = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: () => mainGetUser() } },
  SUPABASE_URL: 'https://exemplo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'chave-publica',
}));

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const createClient = vi.fn((..._args: unknown[]) => ({ auth: { signInWithPassword, signOut } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => createClient(...args) }));

const { signSwapAction, describeSignatureError, SignatureError } = await import('./swapSignature');

describe('signSwapAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: '22999999999@guardshift.com' } } });
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it('confirma a senha numa sessão descartável, que não grava nada no navegador', async () => {
    await signSwapAction('segredo', async () => 'ok');
    expect(createClient).toHaveBeenCalledWith('https://exemplo.supabase.co', 'chave-publica', {
      auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }),
    });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: '22999999999@guardshift.com', password: 'segredo' });
  });

  it('executa a ação com o client recém-autenticado e encerra só esta sessão', async () => {
    const run = vi.fn(async (client: unknown) => client);
    const used = await signSwapAction('segredo', run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(used).toBe(createClient.mock.results[0].value);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('senha errada: não executa a ação e explica', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    const run = vi.fn();
    await expect(signSwapAction('errada', run)).rejects.toThrow('Senha incorreta');
    expect(run).not.toHaveBeenCalled();
  });

  it('encerra a sessão descartável mesmo se a ação falhar', async () => {
    await expect(signSwapAction('segredo', async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('recusa se a senha confirmada for de outro usuário', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'outro' } }, error: null });
    const run = vi.fn();
    await expect(signSwapAction('segredo', run)).rejects.toThrow('não pertence ao usuário logado');
    expect(run).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('usa o telefone quando a conta não tem e-mail', async () => {
    mainGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: null, phone: '5522999999999' } } });
    await signSwapAction('segredo', async () => 'ok');
    expect(signInWithPassword).toHaveBeenCalledWith({ phone: '5522999999999', password: 'segredo' });
  });

  it('sem senha ou sem sessão não chega a tentar', async () => {
    await expect(signSwapAction('', async () => 'ok')).rejects.toBeInstanceOf(SignatureError);
    mainGetUser.mockResolvedValue({ data: { user: null } });
    await expect(signSwapAction('segredo', async () => 'ok')).rejects.toThrow('sessão expirou');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('describeSignatureError', () => {
  it('traduz os erros do banco', () => {
    expect(describeSignatureError({ message: 'ASSINATURA_REQUER_SENHA: confirme sua senha' })).toContain('assinada com sua senha');
    expect(describeSignatureError(new Error('TERMOS_CONGELADOS: x'))).toContain('não pode ter datas');
    expect(describeSignatureError(new Error('outro erro'))).toBeNull();
  });
});
