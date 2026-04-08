

## Plano: Corrigir badge "Aguardando Ciência" em trocas já aprovadas

### Diagnóstico
A troca `2d913e05` está com `status = APPROVED` e `admin_approved = true`, porém `target_confirmation = false`. Isso faz o badge "Aguardando Ciência" aparecer indevidamente.

**Dois bugs encontrados:**

1. **No código do admin (`AdminSwaps.tsx` linha 242-247)**: Quando o admin aprova, o `updateData` NÃO inclui `target_confirmation: true`. Resultado: a troca fica APPROVED mas com `target_confirmation = false`.

2. **No badge (`AdminSwaps.tsx` linha 1198)**: A condição `!request.target_confirmation && request.status !== 'PENDING'` mostra o badge para APPROVED também, quando deveria ser apenas para ACCEPTED.

### Correções

**1. Corrigir dados — SQL no banco**
```sql
UPDATE swap_requests 
SET target_confirmation = true 
WHERE status = 'APPROVED' AND target_confirmation = false;
```

**2. Corrigir `handleDecision` em `AdminSwaps.tsx` (linha ~242)**
Adicionar `target_confirmation: true` ao `updateData` quando o admin aprova:
```ts
const updateData = {
  status: decisionAction === 'approve' ? 'APPROVED' : 'REJECTED',
  admin_approved: decisionAction === 'approve',
  admin_approved_by: adminProfile.id,
  admin_approved_at: new Date().toISOString(),
  target_confirmation: decisionAction === 'approve' ? true : undefined,
};
```

**3. Corrigir condição do badge (linha ~1198)**
Mostrar "Aguardando Ciência" apenas para status ACCEPTED (não para APPROVED):
```tsx
{!request.target_confirmation && request.status === 'ACCEPTED' && (
  <Badge variant="outline" className="text-warning border-warning">
    Aguardando Ciência
  </Badge>
)}
```

### Arquivos alterados
- `src/pages/AdminSwaps.tsx` — duas correções (handleDecision + badge)
- Migração SQL — corrigir registros existentes

