
## Plano de revisão completa da lógica de troca (sem quebrar o sistema)

### Diagnóstico confirmado (com base no código + banco)
1. A troca aprovada do caso Fabio (03/04/2026 ↔ 30/04/2026) existe em `swap_requests` com `status='APPROVED'`.
2. Porém, em `team_schedules`, o dia **30/04/2026** ainda está com a equipe original (não virou “do Fabio” na prática).
3. No `GuardSwapForm`, a seleção de datas ainda depende de `schedule.team_id === currentUser.team_id` (lógica por equipe fixa), então dias recebidos por troca podem não ficar selecionáveis.

---

### Objetivo
Garantir para **todos os seguranças** que, após aprovação:
- o dia recebido passe a contar como “dia dele” para nova troca;
- esse dia apareça no calendário pessoal e no formulário de solicitação;
- a lógica seja robusta mesmo quando houver trocas antigas que não sincronizaram corretamente.

---

### Implementação proposta

#### 1) Criar uma fonte única de “escala efetiva por segurança”
**Novo utilitário compartilhado** (ex.: `src/utils/effectiveSchedule.ts`):
- Entrada: escalas base (`team_schedules`), trocas aprovadas (`swap_requests`) e `guardId`.
- Saída: conjunto/mapa de dias efetivamente pertencentes ao segurança naquele período.
- Regra:
  - começa com os dias da escala base da equipe;
  - para cada troca aprovada envolvendo o segurança:
    - remove o dia que ele cedeu;
    - adiciona o dia que ele recebeu.
- Esse cálculo é idempotente e funciona para histórico (inclusive onde sincronização antiga falhou).

#### 2) Corrigir `GuardSwapForm` para usar escala efetiva (não equipe fixa)
**Arquivo:** `src/components/guards/GuardSwapForm.tsx`
- Substituir `isDateInteractable` por duas regras separadas:
  - calendário “Data do Seu Plantão”: só dias da **escala efetiva do solicitante**;
  - calendário “Data do Plantão que Você Quer Assumir”: só dias da **escala efetiva do alvo selecionado**.
- Buscar trocas aprovadas relevantes para `currentUser` e para `selectedTarget`.
- Manter as validações existentes (datas futuras, diferentes etc.).
- Resultado: se Fabio recebeu 30/04, esse dia fica disponível para ele abrir nova troca.

#### 3) Unificar com o calendário pessoal para evitar divergência
**Arquivo:** `src/components/schedule/GuardPersonalCalendar.tsx`
- Passar a usar o mesmo utilitário da etapa 1.
- Evita cenário de “aparece no calendário pessoal, mas não aparece no formulário” (ou vice-versa).

#### 4) Endurecer sincronização no backend (sem quebrar fluxo atual)
**Migration SQL:** ajustar `public.swap_team_schedules`
- Trocar lógica baseada em `profiles.team_id` por leitura da escala real do dia (`team_schedules` do próprio dia).
- Validar que os `UPDATE`s realmente afetaram linhas; se não afetar, lançar erro explícito.
- Mantém compatibilidade com chamadas atuais via `supabase.rpc('swap_team_schedules', ...)`.

#### 5) Garantir consistência nas duas telas de aprovação
**Arquivos:** `src/pages/AdminSwaps.tsx` e `src/pages/AdminDashboard.tsx`
- Manter chamada do `swapTeamSchedules` após aprovação.
- Se RPC falhar, manter aviso visível e log estruturado.
- Como fallback, o formulário do guarda continuará correto via escala efetiva (etapas 1–3).

---

### Validação (obrigatória)
1. Aprovar troca Fabio 03/04 ↔ 30/04.
2. Entrar como Fabio em “Solicitar Troca de Plantão”.
3. Confirmar que 30/04 aparece em “Data do Seu Plantão”.
4. Criar nova solicitação usando 30/04.
5. Repetir com outro segurança para validar “para todos”.
6. Verificar que calendário pessoal e formulário mostram os mesmos dias.

---

### Escopo de arquivos
- Novo: `src/utils/effectiveSchedule.ts` (ou nome equivalente)
- Alterar:
  - `src/components/guards/GuardSwapForm.tsx`
  - `src/components/schedule/GuardPersonalCalendar.tsx`
  - `src/pages/AdminSwaps.tsx` (ajustes de robustez/feedback)
  - `src/pages/AdminDashboard.tsx` (ajustes de robustez/feedback)
  - `supabase/migrations/*_improve_swap_team_schedules.sql`
