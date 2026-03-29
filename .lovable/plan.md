

## Plano: Corrigir erro RLS ao solicitar folga TRE

### Problema
O erro `new row violates row-level security policy for table "leaves"` ocorre porque não existe uma policy de INSERT para guards na tabela `leaves`. Apenas admins e super_admins podem inserir.

### Alteração

**Migração SQL** — Adicionar policy de INSERT para guards na tabela `leaves` (apenas TRE):

```sql
CREATE POLICY "Guards can insert their own TRE leaves"
  ON public.leaves FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'guard'::app_role)
    AND guard_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND leave_type = 'TRE'
  );
```

Além disso, verificar no `GuardDashboard.tsx` se o campo `admin_id` está sendo preenchido no insert, pois a tabela `leaves` possui esse campo.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Nova policy INSERT para guards em `leaves` (apenas TRE) |
| `src/pages/GuardDashboard.tsx` | Garantir que `admin_id` é passado no insert |

