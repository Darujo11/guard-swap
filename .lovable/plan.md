

## Plano: Corrigir datas erradas no Dashboard do Admin (pendentes)

### Problema

No `AdminDashboard.tsx`, a função `formatDate` usa `new Date(dateString)` para datas no formato `"2026-04-15"`. O JavaScript interpreta isso como **UTC meia-noite**, e no fuso UTC-3 (Brasil) isso vira o **dia anterior** (14/04 em vez de 15/04).

Na página `AdminSwaps.tsx`, já existe o helper `parseDateOnly` que faz o parse correto (split manual da string), por isso lá as datas aparecem certas.

### Solução

Alterar a função `formatDate` no `AdminDashboard.tsx` (linha 352-358) para usar parse local igual ao `AdminSwaps.tsx`:

```typescript
const formatDate = (dateString: string) => {
  // Para datas no formato YYYY-MM-DD, fazer parse local para evitar day-shift por timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};
```

A verificação com regex garante que timestamps completos (como `created_at`) continuem funcionando normalmente, enquanto datas puras (`requester_shift_date`, `target_shift_date`) são parseadas sem erro de timezone.

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminDashboard.tsx` | Corrigir `formatDate` para parse local em datas YYYY-MM-DD |

