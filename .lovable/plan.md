

## Diagnóstico de instabilidade no login

### Achados nos logs (auth_logs últimas horas)

Analisando os logs de auth do Supabase, identifiquei o padrão exato do problema:

**1. "Phone logins are disabled" (HTTP 422)**
```
error_code: phone_provider_disabled
path: /token
```
Toda vez que um segurança tenta logar com WhatsApp, o sistema **primeiro tenta** `signInWithPassword({ phone })` — que **sempre falha com 422** porque o provider de telefone está desabilitado no Supabase. Só então faz fallback para o alias `@guardshift.com`.

Isso causa:
- 1 request extra desnecessário por login (lentidão)
- Erro 422 visível no console (assustador, parece bug)
- Em conexões instáveis, esse 422 pode ser interpretado como "Failed to fetch" pelo navegador

**2. "Refresh Token Not Found" (HTTP 400)**
```
error_code: refresh_token_not_found
grant_type: refresh_token
```
O cliente Supabase tenta renovar tokens que não existem mais (sessão antiga/limpa) e recebe 400. Quando isso acontece durante o boot, o `useAuth` pode entrar em estado inconsistente → **tela branca / loading infinito**.

**3. "Invalid login credentials" (HTTP 400)**
Erros normais de senha errada — não é bug do sistema.

### Causas raiz confirmadas

| # | Sintoma usuário | Causa real |
|---|---|---|
| 1 | "Erro fetch" no login | Tentativa de phone login que retorna 422, interpretada pelo navegador como falha de rede em conexão instável |
| 2 | Tela branca / loading infinito | `useAuth` não trata bem o erro `refresh_token_not_found` — quando o refresh falha, fica preso |
| 3 | "Volta ao normal" sozinho | Safety timeout de 10s força `loading: false`, mas usuário vê branco até lá |

### Plano de correção

**Etapa 1 — Eliminar o 422 do phone login (`src/pages/Login.tsx`)**
- Remover a tentativa de `signInWithPassword({ phone })` 
- Ir **direto** para o alias `${digits}@guardshift.com` quando entrada for numérica
- Resultado: 1 request a menos, sem erro 422 no console, login mais rápido

**Etapa 2 — Tratar refresh token inválido (`src/hooks/useAuth.tsx`)**
- Detectar `AuthApiError` com código `refresh_token_not_found` no `onAuthStateChange`
- Quando ocorrer: limpar localStorage de tokens `sb-*` e forçar `loading: false` + `user: null`
- Adicionar listener para evento `TOKEN_REFRESHED_FAILED` (se disponível na versão do supabase-js)

**Etapa 3 — Reduzir safety timeout de 10s para 5s**
- 10 segundos de tela branca é muito tempo
- 5s já cobre 99% dos casos legítimos de fetch lento
- Usuário recupera mais rápido em caso de falha

**Etapa 4 — Melhorar mensagens de erro no Login**
- Distinguir "Failed to fetch" (rede) vs "Invalid credentials" (senha) vs erro genérico
- Mostrar toast específico pedindo para verificar conexão quando for fetch error

**Etapa 5 — Bump de versão para 4.2.1**
- Forçar refresh do Service Worker para todos os usuários receberem a correção

### Arquivos a editar
- `src/pages/Login.tsx` — remover tentativa phone, melhorar erros
- `src/hooks/useAuth.tsx` — tratar refresh_token_not_found, reduzir timeout
- `public/version.json` — bump para 4.2.1
- `src/lib/version.ts` — bump para 4.2.1

### Não vou mexer em
- RLS policies (estão saudáveis, sem recursão)
- Edge functions (sem erros nos logs)
- Configuração do Supabase (não é necessário habilitar phone login)
- ErrorBoundary (não está sendo o culpado)

