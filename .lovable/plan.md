

## Diagnóstico: Tela branca e erro no login

### Investigação necessária
Preciso verificar:
1. Logs de erro do sandbox (dev-server)
2. Logs de autenticação do Supabase
3. Logs do banco de dados (RLS, queries)
4. Estado das funções edge
5. Código do `Login.tsx` e `useAuth.tsx`

### Hipóteses prováveis
Com base no contexto e nos padrões conhecidos:

**H1 — RLS recursiva ou bloqueio em `profiles`/`user_roles`**
O `useAuth` faz duas queries em paralelo (`user_roles` e `profiles`) logo após o login. Se uma policy bloqueia ou trava, o `loading` fica `true` para sempre → tela branca.

**H2 — Falha no `onAuthStateChange` deadlock**
O código atual usa `setTimeout(async () => ...)` para evitar deadlock, o que é correto. Mas se `getUserRole` ou `getUserProfile` lança exceção silenciosa, o estado pode ficar inconsistente.

**H3 — Sessão corrompida no localStorage**
Tokens antigos/expirados podem causar erro 401 em loop ao tentar restaurar a sessão.

**H4 — Erro no ErrorBoundary (componente crashando)**
Algum componente filho lança erro não tratado → ErrorBoundary mostra fallback ou tela branca.

**H5 — Service Worker servindo bundle antigo**
Após o update da versão 4.1.8, o SW pode estar servindo cache obsoleto.

### Plano de ação

**Etapa 1 — Diagnóstico (read-only)**
1. Verificar logs do dev-server (`/tmp/dev-server-logs/dev-server.log`)
2. Consultar `auth_logs` do Supabase para erros recentes de login
3. Consultar `postgres_logs` para erros de RLS ou queries lentas
4. Consultar `function_edge_logs` para falhas em funções edge
5. Revisar `src/pages/Login.tsx` e o fluxo de autenticação completo
6. Verificar a tabela `profiles` para o usuário que está tentando logar
7. Validar que policies RLS não estão recursivas

**Etapa 2 — Correção (a aplicar conforme achados)**
Possíveis correções dependendo do diagnóstico:
- **Se RLS travada**: revisar/recriar policy problemática
- **Se sessão corrompida**: adicionar limpeza forçada de tokens inválidos no boot
- **Se SW com cache antigo**: forçar `skipWaiting` + limpar cache na nova versão
- **Se componente crashando**: adicionar log no ErrorBoundary para capturar stack
- **Se query lenta/timeout**: adicionar timeout + fallback no `useAuth`

**Etapa 3 — Hardening (preventivo)**
- Garantir que `useAuth` nunca fique preso em `loading: true` (timeout de 10s + fallback)
- Logar o motivo exato da falha de login no console para debug futuro
- Verificar saúde geral: contagem de usuários, perfis órfãos, roles sem perfil

### Pergunta importante
Antes de aplicar correções, preciso saber:
- O erro de login acontece para **todos os usuários** ou apenas alguns?
- A tela branca aparece **antes** do login (no carregamento inicial) ou **depois** de tentar logar?
- Você consegue compartilhar a mensagem de erro exata que aparece (se houver)?

### Arquivos potencialmente alterados (após diagnóstico)
- `src/hooks/useAuth.tsx` — timeout de segurança e logs
- `src/components/ErrorBoundary.tsx` — captura e exibição de erro
- `src/pages/Login.tsx` — tratamento de erro mais robusto
- Migração SQL — caso encontre policy ou dado inconsistente
- `public/version.json` — bump para forçar update se for cache do SW

