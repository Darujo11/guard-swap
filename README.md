# Escala Smart (guard-swap)

Sistema web para gestao completa de equipes de seguranca: escalas, trocas de plantao, horas extras, folgas TRE, fichas funcionais, avaliacao e administracao de assinaturas.

Este README foi escrito para **desenvolvedores** e documenta a aplicacao em profundidade: arquitetura, dominio, banco, Edge Functions, operacao e manutencao.

## Sumario

- [1) Visao geral do produto](#1-visao-geral-do-produto)
- [2) Stack e arquitetura](#2-stack-e-arquitetura)
- [3) Estrutura do repositorio](#3-estrutura-do-repositorio)
- [4) Fluxo funcional end-to-end](#4-fluxo-funcional-end-to-end)
- [5) Rotas da aplicacao](#5-rotas-da-aplicacao)
- [6) Modulos funcionais (o que o sistema faz)](#6-modulos-funcionais-o-que-o-sistema-faz)
- [7) Modelo de dados (Supabase/Postgres)](#7-modelo-de-dados-supabasepostgres)
- [8) Edge Functions](#8-edge-functions)
- [9) Integracoes externas](#9-integracoes-externas)
- [10) Setup local](#10-setup-local)
- [11) Build e deploy](#11-build-e-deploy)
- [12) Seguranca e controles de acesso](#12-seguranca-e-controles-de-acesso)
- [13) Operacao, logs e troubleshooting](#13-operacao-logs-e-troubleshooting)
- [14) Qualidade tecnica e debitos atuais](#14-qualidade-tecnica-e-debitos-atuais)
- [15) Guia rapido de evolucao](#15-guia-rapido-de-evolucao)

## 1) Visao geral do produto

O Escala Smart atende tres perfis:

- `guard`: visualiza sua rotina, solicita trocas, acompanha aprovacoes, registra demandas individuais.
- `admin`: gerencia equipe, escalas, trocas, fichas, extras, folgas e configuracoes da organizacao.
- `super_admin`: gerencia planos, administradores, relatorios globais e reset de senha administrativo.

Objetivos centrais do sistema:

- organizar escalas de trabalho por equipe;
- permitir trocas de plantao entre profissionais;
- registrar extras e folgas com rastreabilidade;
- manter historico funcional e avaliativo por profissional;
- automatizar notificacoes e lembretes via WhatsApp.

## 2) Stack e arquitetura

### Frontend

- React 18 + TypeScript + Vite 5 (`@vitejs/plugin-react-swc`)
- Roteamento com `HashRouter` (`react-router-dom`)
- UI com Tailwind CSS + shadcn/ui + Radix
- Estado de servidor com `@tanstack/react-query`
- Formularios com `react-hook-form` + `zod`
- PWA com `vite-plugin-pwa`

### Backend (BaaS + serverless)

- Supabase Auth
- Supabase Postgres (RLS, RPC, migrations)
- Supabase Edge Functions (Deno)

### Arquitetura de alto nivel

- Cliente SPA em `src/`
- Dados e autenticacao no Supabase
- Regras de dominio distribuidas entre:
  - frontend (`hooks`, `pages`, `utils`);
  - SQL/RPC no banco (`supabase/migrations`);
  - Edge Functions (`supabase/functions`).

## 3) Estrutura do repositorio

```text
guard-swap/
├── src/
│   ├── pages/                      # Telas principais por perfil
│   ├── components/                 # Componentes UI e de dominio
│   ├── hooks/                      # Hooks de autenticacao, SW, notificacoes etc.
│   ├── integrations/supabase/      # Cliente Supabase e tipos gerados
│   ├── lib/                        # Tipos, utilitarios, versao
│   ├── utils/                      # Regras utilitarias e geracao de PDF
│   └── data/                       # Dados estaticos (avaliacao etc.)
├── supabase/
│   ├── migrations/                 # Historico SQL (schema, RLS, cron, RPC)
│   ├── functions/                  # Edge Functions (Deno)
│   └── config.toml                 # Config de funcoes (verify_jwt)
├── docs/
│   └── sistema-lembrete-trocas.md  # Documento operacional do lembrete diario
├── public/                         # Assets estaticos/PWA
├── vite.config.ts
└── package.json
```

Arquivos de entrada mais importantes:

- `src/main.tsx`
- `src/App.tsx`
- `src/hooks/useAuth.tsx`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`

## 4) Fluxo funcional end-to-end

1. Usuario acessa app em `/#/` ou `/#/login`.
2. Tela de login autentica com Supabase Auth.
3. `useAuth` busca sessao + papeis em `user_roles`.
4. `ProtectedRoute` libera ou bloqueia rotas conforme `allowedRoles`.
5. Usuario cai no dashboard do papel (`guard`, `admin` ou `super_admin`).
6. Operacoes de dados usam:
   - acesso direto ao Postgres via cliente Supabase;
   - RPCs (ex.: troca de escala);
   - Edge Functions para fluxos administrativos e notificacoes.

## 5) Rotas da aplicacao

Definidas em `src/App.tsx`.

### Publicas

- `/#/` e `/#/login`: login
- `/#/home`: landing/marketing
- `/#/teste-gratuito`: cadastro trial
- `/#/verificar` e `/#/verificar/:codigo`: verificacao publica do comprovante de troca (assinatura eletronica)

### Admin

- `/#/dashboard/admin`
- `/#/admin/trocas`
- `/#/admin/segurancas`
- `/#/admin/fichas`
- `/#/admin/ficha/:guardId`
- `/#/admin/escalas`
- `/#/admin/extras`
- `/#/admin/folgas`
- `/#/simulador-avaliacao/:id?`
- `/#/historico-avaliacoes`

### Guard

- `/#/dashboard/guard`
- `/#/perfil`

### Super Admin

- `/#/super-admin/planos`
- `/#/super-admin/administradores`
- `/#/super-admin/relatorios`
- `/#/super-admin/resetar-senha`
- `/#/criar-super-admin`: cria/atualiza super admin (exige estar logado como super admin)

## 6) Modulos funcionais (o que o sistema faz)

### 6.1 Autenticacao e autorizacao

- Login por email/senha.
- Fluxo por telefone para guardas (telefone convertido em login `numero@guardshift.com`).
- Persistencia de sessao no `localStorage`.
- Resolucao de papel por prioridade (`super_admin > admin > guard`).
- Logout com limpeza forcada de tokens locais.

### 6.2 Gestao de segurancas (admin)

- Cadastro de segurancas.
- Vinculacao a equipes.
- Definicao de chefe de turno.
- Ativacao/desativacao de perfil.
- Perfil detalhado por profissional (dados cadastrais e historico).

### 6.3 Equipes e escalas

- Cadastro de equipes (`teams`) com metadados.
- Alocacao de segurancas em equipes.
- Cadastro/manutencao de escalas em `team_schedules`.

### 6.4 Trocas de plantao

- Solicitacao de troca entre profissionais.
- Confirmacao do alvo da troca.
- Aprovacao/reprovacao administrativa.
- Registro de status e trilha temporal.
- A escala efetiva e derivada na leitura: `team_schedules` permanece imutavel e
  as trocas aprovadas sao aplicadas por cima (`src/utils/effectiveSchedule.ts`).
  Aprovar uma troca so grava `status = 'APPROVED'`.
- Assinatura eletronica: solicitar, aceitar, recusar, cancelar, aprovar e rejeitar exigem
  declaracao + senha; o banco grava cada ato em `swap_signatures` (append-only) e congela
  os termos da troca depois de solicitada. Ver `docs/assinatura-eletronica.md`.
- Comprovante impresso (A4, logo da Camara) com as assinaturas e codigo de verificacao
  (`src/utils/swapReceipt.ts`); verificacao publica em `/#/verificar/:codigo`.
- Aviso por WhatsApp a cada etapa da troca, inclusive cancelamento, disparado pelo banco
  (`notify-swap-event`).
- Lembrete diario automatico para trocas aprovadas com plantao no dia seguinte.

### 6.5 Horas extras

- Registro de extras com tipo percentual e quantidade/minutos.
- Vinculo com guarda e mes de referencia.
- Listagem e exclusao (com contexto administrativo).

### 6.6 Folgas e TRE

- Registro de pedidos de folga com periodo, tipo e observacoes.
- Controle de cotas TRE por profissional (`guard_tre_quotas`).
  - Saldo = cota total - dias ja usados antes do sistema (`pre_used_days`) - dias de TRE nao
    recusados. Pedido pendente ja desconta; recusado nao conta (igual nas telas do coordenador
    e do seguranca desde 2026-11-03).
  - O seguranca so cria e so cancela TRE pendente (regra no banco, migration
    `20261103120000_tre_leave_guard_rules`). TRE aprovado ou recusado so o coordenador remove.
- Notificacao de solicitacao para admin.
- Notificacao de decisao (aprovado/rejeitado) para guarda.

### 6.7 Fichas e observacoes

- Registro de anotacoes funcionais (`guard_notes`).
- Consolidacao de historico no perfil do profissional.

### 6.8 Avaliacao de desempenho

- Simulador de avaliacao.
- Historico de avaliacoes (`evaluations`).
- Armazenamento de notas e score total.

### 6.9 Planos e assinaturas (super admin)

- Gestao de `subscription_plans`.
- Vinculo de plano por admin em `admin_subscriptions`.
- Trial de 7 dias no fluxo de criacao trial.
- Relatorios de administradores e status.

### 6.10 PWA e atualizacao de versao

- App instalavel (manifest + service worker).
- Polling de `version.json`.
- Prompt de atualizacao ao detectar versao mais nova.
- `forceReload` com limpeza de cache em cenarios de update forcado.

## 7) Modelo de dados (Supabase/Postgres)

Fonte tipada: `src/integrations/supabase/types.ts`.

### Tabelas principais

- `profiles`: perfil de usuario e dados operacionais.
- `user_roles`: papel do usuario (`admin`, `guard`, `super_admin`).
- `teams`: equipes.
- `team_schedules`: escalas por equipe/data.
- `swap_requests`: solicitacoes de troca.
- `extras`: registros de horas extras.
- `leaves`: registros de folgas/licencas.
- `guard_tre_quotas`: cotas TRE por guarda.
- `guard_notes`: anotacoes funcionais.
- `evaluations`: avaliacoes de desempenho.
- `organization_settings`: customizacao e regras por admin.
- `subscription_plans`: catalogo de planos.
- `admin_subscriptions`: assinatura ativa por admin.
- `audit_logs`: trilha de auditoria.
- `swap_notifications`: fila (outbox) dos avisos de troca por WhatsApp.
- `swap_signatures`: assinaturas eletronicas dos atos de troca (append-only).
- `keep_alive`: controle tecnico de atividade.

### Funcoes RPC relevantes

- `get_available_guards_for_swap()`: candidatos para troca (so para quem tem papel `guard`).
- `verify_swap_document(codigo)`: verificacao publica do comprovante (dados minimos).
- `has_role(...)`: verifica papel de usuario.
- `is_super_admin(...)` / `is_admin_active(...)`: regras de permissao/estado.
- `get_user_id_by_email(...)`: so `service_role` (usada pelas edge functions).
- `check_admin_subscription_status(...)`: valida situacao de assinatura.
- `swap_team_schedules(...)`: legado, sem uso; so `service_role`. A escala efetiva e
  calculada na leitura (`effectiveSchedule.ts`) - chamar essa RPC contaria a troca duas vezes.

## 8) Edge Functions

Diretorio: `supabase/functions/`.

### Provisionamento e administracao de usuarios

- `create-admin`: cria/atualiza admin e role (somente super_admin).
- `create-guard`: cria guarda com login baseado em telefone (admin ativo, so na propria
  organizacao, ou super_admin).
- `create-trial-admin`: cria admin + assinatura trial + settings iniciais (publica, cadastro trial).
- `create-super-admin`: cria super admin por email (somente super_admin).
- `create-super-admin-phone`: cria/atualiza super admin por telefone (somente super_admin).
- `update-admin`: atualiza dados de admin (somente super_admin).
- `delete-admin`: exclusao em cascata dos dados do admin (somente super_admin).
- `update-auth-email`: atualiza email de login com base no telefone.
- `reset-user-password`: reset de senha (acesso de super admin).

### Operacao e notificacao

- `notify-swap-event`: envia os avisos de cada etapa da troca por WhatsApp (chamada pelo trigger `trg_enqueue_swap_notification`).
- `send-swap-webhook`: desativada (no-op); mantida so para clientes PWA antigos.
- `notify-swap-reminder`: lembrete diario de troca aprovada para o dia seguinte.
- `notify-tre-leave`: notifica admin sobre solicitacao de folga TRE.
- `notify-tre-leave-guard`: notifica guarda sobre decisao da folga.
- `forgot-password`: reset por telefone e envio de nova senha via WhatsApp.

Os textos de todas as mensagens de WhatsApp ficam em `supabase/functions/_shared/messages.ts`
(testes em `messages.test.ts`, rodar com `deno test`).

### Suporte/teste

- `create-test-guard`: cria usuario de teste rapido (somente super_admin).
- `reset-test-guard`: recria usuario de teste padrao (somente super_admin; recusa apagar conta que nao seja de teste).

### Configuracao de JWT por funcao

Em `supabase/config.toml`, cada funcao define `verify_jwt = true/false`.

- `verify_jwt = true` NAO protege sozinho: a anon key publica e um JWT valido.
- Toda funcao administrativa valida o chamador no corpo (`auth.getUser` + papel em `user_roles`).
- `notify-swap-event` tem `verify_jwt = false` de proposito (chamada pelo `pg_net`), mas so processa
  eventos `pending` da fila `swap_notifications`.

## 9) Integracoes externas

### Supabase

- Projeto: `wyoysecfbmmidjiofymg`
- URL usada no cliente: `https://wyoysecfbmmidjiofymg.supabase.co`

### WhatsApp (Evolution API)

- Endpoint usado nas funcoes: `https://evolution.autozapx.com/message/sendText/escala`
- Envio de mensagens para:
  - avisos de cada etapa da troca e lembrete de troca;
  - solicitacao/retorno de folga TRE;
  - reset de senha.
- Textos: `supabase/functions/_shared/messages.ts`.

### Avisos de troca (sem n8n)

- Trigger em `swap_requests` grava o evento em `swap_notifications` e chama `notify-swap-event` via `pg_net`.
- O webhook n8n `https://webhook.autozapx.com/webhook/show` nao e mais usado.
- Documentacao completa em `docs/sistema-avisos-trocas.md`.

### Cron diario (Supabase)

- Job `pg_cron` chama `notify-swap-reminder` diariamente.
- Documentacao operacional completa em `docs/sistema-lembrete-trocas.md`.

## 10) Setup local

### Pre-requisitos

- Node.js 18+ (recomendado LTS)
- npm

### Instalacao

```sh
npm install
```

### Executar em desenvolvimento

```sh
npm run dev
```

Servidor Vite por padrao:

- host: `::`
- porta: `8080`

### Scripts disponiveis

- `npm run dev` - ambiente de desenvolvimento
- `npm run build` - build de producao
- `npm run build:dev` - build em modo development
- `npm run preview` - preview local do build
- `npm run lint` - lint do projeto
- `npm run typecheck` - checagem de tipos sem emitir build
- `npm test` - suite de testes (Vitest, execucao unica)
- `npm run test:watch` - suite de testes em modo watch

## 11) Build e deploy

### Build

```sh
npm run build
```

Saida: pasta `dist/`.

### Caracteristicas de build

- target JS: `es2015`
- `manualChunks` para separar vendors (`react`, `ui`, `supabase`)
- PWA com cache controlado e fallback de navegacao

### Deploy

O projeto saiu do Lovable. Cada parte sobe de um jeito:

| Parte | Como publica |
|---|---|
| Frontend (`escalasmart.com.br`) | Automatico: push na `main` -> Cloudflare rebuilda em ~1 min |
| Edge Functions | Manual: `npx supabase functions deploy <nome> --project-ref wyoysecfbmmidjiofymg --use-api` (precisa de `SUPABASE_ACCESS_TOKEN`) |
| Migrations | Manual: rodar o SQL no banco (SQL Editor ou `psql`). `supabase_migrations.schema_migrations` nao e confiavel desde 2026-04 |

Ordem: quando uma mudanca depende de funcao/migration nova, publicar a funcao e a migration
ANTES do push do frontend (o push vai ao ar sozinho).

Versao: atualizar `package.json` (`npm version X --no-git-tag-version`), `src/lib/version.ts`
e `public/version.json`. `forceUpdate: true` recarrega quem estiver na versao antiga.

## 12) Seguranca e controles de acesso

### O que existe hoje

- Controle de acesso por papel no frontend (`ProtectedRoute`) e, de verdade, no banco (RLS).
- RLS isolando organizacoes (`admin_id`): avaliacoes, auditoria, escalas e equipes so da propria
  organizacao (migration `20261023140000_org_isolation`).
- Cadastro aberto do Supabase Auth desligado (`disable_signup`); contas so via edge functions.
- Edge functions administrativas exigem super_admin; `create-guard` exige admin da propria organizacao.
- Assinatura eletronica com senha recente nos atos de troca (`swap_signatures`).
- Afastamentos TRE: o seguranca so insere ou apaga TRE com status `PENDING` (RLS, 2026-11-03).
- Comprovantes impressos com `escapeHtml` + CSP `default-src 'none'` (`src/lib/html.ts`).

### Pontos de atencao abertos (revisao de 2026-10-23)

- Senha padrao `123456` em uso por boa parte das contas (inclusive super admins); `create-guard`
  ainda cria contas com ela.
- `notify-tre-leave-guard` e `notify-tre-leave` aceitam chamadas com a anon key: da para mandar
  WhatsApp pelo numero da empresa.
- `forgot-password` deixa qualquer pessoa trocar a senha de outro usuario sabendo o telefone.
- `suspend_expired_admins` / `check_admin_subscription_status` executaveis por anon.
- `keep_alive` sem RLS; bucket `leave-documents` publico.
- Datas sem hora exibidas com `new Date('AAAA-MM-DD')` em `SuperAdminReports.tsx` (um dia antes).

## 13) Operacao, logs e troubleshooting

### Onde observar

- Console do navegador (frontend).
- Logs das Edge Functions no dashboard Supabase.
- Resultado dos jobs `pg_cron` no banco.

### Problemas comuns

- Sessao invalida ou refresh token quebrado:
  - `useAuth` limpa tokens e volta para login.
- Troca aprovada sem lembrete:
  - validar cron, status `APPROVED`, data de plantao e telefone do perfil.
- Mensagem WhatsApp nao enviada:
  - conferir secret da instancia e status do provedor externo.
- Aviso de troca nao chegou:
  - consultar `swap_notifications` (coluna `status`/`error`) e os logs de `notify-swap-event`.
- Erro `ASSINATURA_REQUER_SENHA` ao mexer em troca:
  - a acao nao veio de uma confirmacao de senha recente (app antigo em cache: recarregar).
- Erro `TERMOS_CONGELADOS`:
  - tentativa de alterar pessoas/datas/motivo de troca ja solicitada (bloqueado de proposito).

## 14) Qualidade tecnica e debitos atuais

### Testes

Suite em Vitest (`vitest.config.ts`, ambiente `node`), cobrindo a regra mais
sensivel do dominio: a escala efetiva depois das trocas aprovadas.

- `src/utils/effectiveSchedule.test.ts` - dia cedido, dia assumido, simetria
  entre os dois lados da troca, independencia da ordem em que as trocas chegam
  do banco e tolerancia a trocas sem perfis carregados.
- `src/utils/schedulePdf.test.ts` - classificacao e totais do relatorio:
  plantao cedido nunca conta como trabalhado, precedencia de afastamento sobre
  plantao e o texto de detalhamento com protocolo da troca.

- `src/lib/html.test.ts` - escape de HTML, CSP do documento impresso e validacao de URLs.
- `src/utils/swapReceipt.test.ts` - comprovante de troca (escape, quem assume cada plantao,
  andamento por status, bloco de assinaturas).
- `src/lib/swapSignature.test.ts` - confirmacao de senha em sessao descartavel.
- `supabase/functions/_shared/messages.test.ts` - textos do WhatsApp (Deno:
  `npx deno@2.1.4 test --no-lock --allow-env supabase/functions/_shared/messages.test.ts`).

Rodar com `npm test`. Nao ha testes de componente nem de integracao com o Supabase.

### Debitos abertos

- **TypeScript permissivo**: `noImplicitAny: false` e `strictNullChecks: false`.
- **Arquivos de pagina grandes**: alta concentracao de regra e UI em alguns
  modulos (`AdminExtras.tsx` passa de 2.300 linhas).
- **Historico longo de migrations**: exige disciplina de versionamento no Supabase.
- **QR code no comprovante**: pendente; exige nova dependencia e confirmar qual lockfile
  (`bun.lock`, `bun.lockb` ou `package-lock.json`) o build do Cloudflare usa.

## 15) Guia rapido de evolucao

### Para adicionar nova funcionalidade de negocio

1. criar/ajustar schema em `supabase/migrations`;
2. regenerar/atualizar tipos do Supabase em `src/integrations/supabase/types.ts`;
3. implementar casos de uso em `pages`, `components` e `hooks`;
4. se houver acao privilegiada, criar Edge Function dedicada;
5. mapear permissao por papel em `ProtectedRoute` e regras de consulta;
6. atualizar este README e documentacao de operacao quando necessario.

### Para manter estabilidade em producao

- validar fluxos criticos antes de deploy:
  - login;
  - criacao de guarda/admin;
  - solicitacao e aprovacao de troca;
  - notificacoes WhatsApp;
  - cron de lembrete diario.
- acompanhar logs de funcoes apos cada release.
- manter versionamento coerente entre codigo e metadados de release.
