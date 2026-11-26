# Escala Smart (guard-swap)

Gestão de escalas, trocas de plantão, extras e folgas de equipes de segurança. Cliente atual: Câmara Municipal de Macaé (logo e marca no app e no comprovante). Multi-organização: cada coordenador (`admin`) é uma organização; `profiles.admin_id` aponta para o perfil do coordenador (o do próprio admin aponta para ele mesmo).

Stack: React 18 + Vite + TypeScript + shadcn/ui (SPA com `HashRouter`), Supabase (Auth, Postgres com RLS, Edge Functions em Deno), WhatsApp via Evolution API. Visão completa no `README.md`.

Interface, mensagens, comentários e commits em português.

## Comandos

```bash
npm run dev          # Vite em :8080 (aponta para o Supabase de PRODUÇÃO, não há ambiente de teste)
npm run typecheck
npm test             # Vitest (src/**/*.test.ts)
npm run build
npx -y deno@2.1.4 check --no-lock supabase/functions/<nome>/index.ts
npx -y deno@2.1.4 test --no-lock --allow-env supabase/functions/_shared/messages.test.ts   # PRINT=1 imprime os textos
```

O lint tem dezenas de problemas antigos (`any`, `prefer-const`): compare antes/depois nos arquivos tocados em vez de exigir zero.

**Testar tela sem tocar produção** (usado em 2026-11-04): Playwright global (`require($(npm root -g)/playwright)`) contra o `npm run dev`, com `context.route(/supabase\.co/)` respondendo TUDO com dados falsos (sessão fake no `localStorage` em `sb-wyoysecfbmmidjiofymg-auth-token`, `user_roles`/`profiles` conforme o papel, PATCH/POST só registrados). Rotas usam hash: `http://localhost:8080/#/admin/folgas`. O `google-chrome --headless --screenshot` sozinho captura só o spinner do login; use Playwright. Mock incompleto quebra telas (ex.: troca sem `created_at` derruba `GuardSwapList`) — não é bug do app. Em 2026-11-26 o Playwright global não existia; funcionou o `playwright-core` de `$(npm root -g)/dev-browser/node_modules/playwright-core` (Chromium já instalado), com `context.routeWebSocket(/supabase\.co/, ws => ws.close())` para o realtime não ir à produção. PDF (jsPDF) dá para gerar no Node com um teste Vitest fora de `src/` e ver as páginas renderizando com pdf.js (cdnjs) numa página do Playwright. A máquina tem pouca memória livre: derrube o `npm run dev` ao terminar.

## Deploy (o projeto NÃO está mais no Lovable)

- **Frontend:** push na `main` publica sozinho em `escalasmart.com.br` (Cloudflare, ~1 min). Não existe staging.
- **Edge Functions:** não sobem com o push. `npx -y supabase@2.20.12 functions deploy <nome> --project-ref wyoysecfbmmidjiofymg --use-api` com `SUPABASE_ACCESS_TOKEN` fornecido pelo dono. Passe `--no-verify-jwt` nas que têm `verify_jwt = false` em `supabase/config.toml`.
- **Migrations:** não sobem com o push e `supabase_migrations.schema_migrations` parou de ser atualizada em 2026-04. Aplicar o SQL manualmente; ensaiar antes numa transação com `ROLLBACK` simulando usuários (`set local role authenticated` + `request.jwt.claims`).
- **Ordem:** se o frontend depende de função/migration nova, publique a função e a migration ANTES do push (em 2026-10-23 um push antecipado deixou os avisos fora do ar por ~20 min).
- **Versão:** `npm version X.Y.Z --no-git-tag-version` + `src/lib/version.ts` + `public/version.json`. `forceUpdate: true` recarrega clientes antigos (PWA); usar quando a versão antiga quebraria com a mudança e desligar depois de 1–2 dias (a da 4.6.0 foi desligada em 2026-11-03). Com `false`, quem está em versão antiga vê o aviso "Nova versão disponível". Ajustes pequenos sem bump de versão chegam quando a página recarrega.
- **Conferir publicação:** o site atualiza ~2 min após o push; compare o `assets/index-*.js` de `https://escalasmart.com.br/` antes/depois e procure o trecho novo no bundle. Com bump de versão, basta consultar `https://escalasmart.com.br/version.json?t=<agora>` até mostrar a versão nova (a 4.7.0 apareceu em ~2 min).
- **Git:** commits feitos nesta máquina saem como "Fabio Ventura" (config global); o histórico anterior é "venturax". O dono ainda não pediu para padronizar.

## Regras do domínio que não podem quebrar

- **Escala efetiva = `team_schedules` + trocas APROVADAS aplicadas na leitura** (`src/utils/effectiveSchedule.ts`). `team_schedules` não é reescrita ao aprovar; `swap_team_schedules()` é legado e só service role executa.
- **Trocas são atos assinados** (`docs/assinatura-eletronica.md`): toda mudança de status de `swap_requests` feita por usuário precisa vir de `signSwapAction` (`src/lib/swapSignature.ts`), senão o banco recusa com `ASSINATURA_REQUER_SENHA`. Termos (pessoas, datas, motivo, `admin_id`) são congelados depois de solicitada (`TERMOS_CONGELADOS`). `swap_signatures` é append-only.
- **Transições de status** são validadas no banco (`enforce_swap_request_transition`); não confie só na UI.
- **Avisos de WhatsApp das trocas saem do banco**, não do navegador: trigger → fila `swap_notifications` → `notify-swap-event` (`docs/sistema-avisos-trocas.md`). Não volte a chamar edge function de aviso a partir das telas.
- **Saldo TRE = `total_days` − `pre_used_days` − dias de TRE não recusados** (pendente já desconta). A mesma regra vale em `AdminLeaves.tsx` (tabela do coordenador) e `GuardDashboard.tsx` (painel do segurança); se mudar uma, mude a outra. Até 2026-11-03 a do coordenador contava recusados.
- **TRE pelo segurança:** só cria e só cancela pedido `PENDING`, e isso vale no banco (RLS `20261103120000_tre_leave_guard_rules`). Aprovado ou recusado só o coordenador remove.
- **Decisões de TRE deixam rastro** (`src/lib/treDecision.ts`): recusar no painel (`AdminDashboard.tsx`) e reverter decisão (aprovado ↔ recusado, só pelo botão em `AdminLeaves.tsx`) exigem motivo de 10+ caracteres, que vai para `leaves.notes` e para `audit_logs` (`TRE_REJECTED`, `TRE_DECISION_REVERTED`; aprovar grava `TRE_APPROVED`). Updates condicionados ao status atual (`.eq('status', ...)`).
- **Pedido de TRE só em dia de plantão** da escala efetiva (inclui plantão assumido em troca; exclui cedido, dia com afastamento e dia com TRE pendente). A trava está só na tela (`GuardPersonalCalendar` em modo seleção), não no banco. Não compense recusa mexendo em `pre_used_days` (em 2026-11-03 fizeram isso no Verneque e a escala ficou sem o afastamento de 24/10).
- **Relatório mensal de plantões** (`/admin/relatorio`, 4.7.0 de 2026-11-26; regras em `src/utils/monthlyDutyReport.ts`, PDF em `monthlyDutyReportPdf.ts`, tela em `AdminMonthlyReport.tsx`): reproduz a escala em papel da coordenação (grade do mês + quadro "Observações"). Monta cada dia com `computeEffectiveSchedule`, não com lógica própria; quem assume troca ocupa a posição de quem cedeu. Afastamento aprovado vale no período todo, mas só em dia de plantão da pessoa (fora disso vira aviso na tela, não some calado). Decisões do dono:
  - Extra se escreve **"EXTRA" em amarelo**, nunca "HE".
  - Cobertura não é ligada: o dia mostra o ausente riscado e quem fez extra lado a lado. Ligar "quem cobriu quem" exigiria coluna nova em `extras` + migration manual; foi oferecido e o dono não escolheu. Não deduzir pareamento por heurística.
  - Banco de horas em cinza (código BH); demais afastamentos em vermelho.
  - "Não podem fazer hora extra", "Eventos diversos" e "Demais observações" não existem no banco: digitados na tela, rascunho só no `localStorage` (`escalasmart:relatorio-mensal:<admin>:<AAAA-MM>`).
  - O `AdminDutyCalendar` do painel ainda marca afastamento (exceto férias) só no 1º dia; o relatório usa o período todo. Se for alinhar, alinhe o calendário ao relatório, não o contrário.
- **Textos de WhatsApp** só em `supabase/functions/_shared/messages.ts` (aprovados pela coordenação: sem "mensagem automática", sem artigo antes de nome, datas com dia da semana).

## Segurança (aprendido na revisão de 2026-10-23)

- `verify_jwt = true` não protege: a anon key pública é um JWT válido. Toda edge function que faz algo privilegiado valida o chamador no corpo (`auth.getUser(token)` + papel em `user_roles`) e nunca confia em `admin_id`, telefone ou destinatário vindos do cliente.
- RLS isola organizações por `admin_id` (`get_profile_id`, `get_user_admin_id`). Política nova sem filtro de organização vaza dados entre clientes.
- Funções `SECURITY DEFINER` em `public` viram RPC para anon por padrão: `revoke execute ... from public, anon, authenticated` quando não forem para o app. Não revogue as usadas dentro de policies (`has_role`, `get_profile_id`, `get_user_admin_id`, `is_admin_active`, `user_belongs_to_admin_org`).
- Cadastro aberto do Auth está desligado (`disable_signup`); contas só pelas edge functions.
- HTML montado como string (comprovantes) passa por `escapeHtml` e leva `PRINT_DOCUMENT_CSP_META` (`src/lib/html.ts`). Links gravados por usuários só abrem via `getSafeUrlWithPrefix`.
- Pendências conhecidas: ver "Pontos de atenção abertos" no README (senha padrão `123456`, `notify-tre-leave*` e `forgot-password` abertos, etc.) e "Pendências do processo de afastamentos" (TRE pendente fora da escala, afastamento de vários dias, trava de dia sem plantão só na tela). Relatório mensal: equipe de cada pessoa é a atual (`profiles.team_id` não tem histórico) e inativos saem da grade, então meses antigos saem com a composição de hoje; ainda não foi conferido com dados reais de produção (só com dados falsos).

## Acesso ao banco

- `wyoysecfbmmidjiofymg` não está na conta Supabase conectada ao MCP (permission denied). Consultas via `psql`/`pg` com a connection string que o dono fornecer; escritas em produção costumam ser barradas pelo modo automático — prepare o script e peça para o dono rodar com `!`.
- Nunca commitar credenciais: o arquivo local `acessos` fica fora do Git (`.git/info/exclude`). As chaves dele estão desativadas desde a limpeza de 2026-10-23 (401).
- Caminho que funciona (2026-11-03): script Node em pasta temporária, rodado pelo dono com `!`, lendo a chave de variável de ambiente. Para dados, REST (`/rest/v1/...`) com `SUPABASE_KEY` (secret `sb_secret_...`). Para catálogo/regras (`pg_policies` etc.), Management API `POST https://api.supabase.com/v1/projects/wyoysecfbmmidjiofymg/database/query` com `{"query": ..., "read_only": true}` e `SUPABASE_ACCESS_TOKEN` (`sbp_...`). Não ler chaves de arquivo nem pedir para colar na conversa.
