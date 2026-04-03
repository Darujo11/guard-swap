

## Plano: Mostrar trocas pendentes de aprovação no topo (mobile)

### Problema
No celular, as trocas que precisam de aprovação do admin ficam misturadas na listagem por mês, sem destaque. O admin precisa ver primeiro as que requerem ação.

### Solução
Adicionar um card "Aguardando Aprovação" antes da listagem por mês, visível apenas no mobile (classe `md:hidden`), que mostra as solicitações com status `ACCEPTED` (aceitas pelo segurança, aguardando aprovação do admin). Cada item terá os mesmos botões de Aprovar/Rejeitar.

### Alteração

| Arquivo | Detalhe |
|---------|---------|
| `src/pages/AdminSwaps.tsx` | Filtrar `filteredAndSortedRequests` com status `ACCEPTED` em um `pendingApproval` memo. Renderizar um card destacado antes do `sortedMonthKeys.map(...)`, visível apenas em telas pequenas (`md:hidden`), listando essas trocas com botões de ação. |

### Estrutura do card (mobile only)

```text
┌──────────────────────────────┐
│ ⚠️ Aguardando Sua Aprovação  │
│ 2 solicitações               │
├──────────────────────────────┤
│ Carlos → Junior              │
│ 15/04 → 18/04    [✓] [✗]   │
├──────────────────────────────┤
│ Dinarte → Flavio             │
│ 20/04 → 22/04    [✓] [✗]   │
└──────────────────────────────┘
```

Este card aparece apenas quando há solicitações aceitas aguardando aprovação do admin, e somente em telas mobile. No desktop o layout continua igual.

