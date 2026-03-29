

## Plano: Permitir apagar folga TRE mesmo após aprovada

### Alteração

**Arquivo:** `src/pages/GuardDashboard.tsx`

Remover a condição `leave.status === 'PENDING'` que restringe o botão "Cancelar" apenas a folgas pendentes. O botão aparecerá para folgas com qualquer status (PENDING ou APPROVED), permitindo que o segurança cancele/desfaça a folga a qualquer momento.

Linha ~733: trocar `{leave.status === 'PENDING' && (` por `{leave.status !== 'REJECTED' && (` — assim o botão aparece para pendentes e aprovadas, mas não para rejeitadas.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GuardDashboard.tsx` | Mostrar botão Cancelar para folgas PENDING e APPROVED |

