

## Plano: Atualizar escala automaticamente após aprovação de troca

### Problema
Quando o admin aprova uma troca de plantão, a escala no calendário não reflete a troca. O solicitante e o alvo trocam de dia, mas o calendário continua mostrando as equipes originais.

### Solução
Após a aprovação da troca no `AdminSwaps.tsx`, trocar os `team_id` dos registros em `team_schedules` para as duas datas envolvidas.

**Lógica:**
1. Buscar o `team_id` do solicitante (via `profiles`) e do alvo
2. No `team_schedules`, encontrar o registro da `requester_shift_date` e trocar o `team_id` para o time do alvo
3. No `team_schedules`, encontrar o registro da `target_shift_date` e trocar o `team_id` para o time do solicitante

Exemplo: Solicitante (Equipe Azul) tem plantão dia 30/03, Alvo (Equipe Vermelha) tem plantão dia 29/03.
- Após aprovação: dia 29/03 → Equipe Azul, dia 30/03 → Equipe Vermelha (trocam)

### Alteração

**Arquivo:** `src/pages/AdminSwaps.tsx`

Após a linha que faz o `update` do status para `APPROVED` (linha ~252), adicionar lógica para:

1. Buscar o `team_id` do requester e do target via `profiles`
2. Atualizar `team_schedules` na `requester_shift_date`: trocar `team_id` para o time do target
3. Atualizar `team_schedules` na `target_shift_date`: trocar `team_id` para o time do requester

```text
Fluxo:
  Admin aprova troca
    → Update swap_requests status = APPROVED
    → Busca team_id do requester e target
    → Swap team_ids nas datas em team_schedules
    → Webhook + audit log (já existente)
```

### Escopo
- Apenas `src/pages/AdminSwaps.tsx` — adicionar ~30 linhas após a aprovação

