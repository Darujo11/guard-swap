

## Plano: Corrigir afastamentos não aparecendo no calendário

### Problema

Quando o admin registra um afastamento, ele é inserido com `status = 'PENDING'` (default do banco). Porém, o calendário pessoal do segurança filtra apenas `status = 'APPROVED'`, por isso o afastamento não aparece.

### Solução

Duas correções necessárias:

1. **`src/pages/AdminLeaves.tsx`**: Quando o admin registra um afastamento, definir `status: 'APPROVED'` automaticamente (pois foi o próprio admin que registrou, não precisa de aprovação).

2. **`src/components/schedule/GuardPersonalCalendar.tsx`**: Além de filtrar `APPROVED`, também incluir `PENDING` na query de leaves para garantir que afastamentos pendentes também apareçam no calendário. Alternativamente, manter apenas `APPROVED` se a correção do item 1 resolver.

### Abordagem escolhida

Aplicar o item 1: ao inserir o leave pelo admin, enviar `status: 'APPROVED'`. Isso é suficiente pois o admin é a autoridade que aprova. Afastamentos criados pelo segurança (TRE) já têm fluxo separado de aprovação.

### Escopo

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminLeaves.tsx` | Adicionar `status: 'APPROVED'` no insert de leaves (~linha 303) |

