

## Plano: Corrigir registros antigos com status PENDING

### Problema

O código já insere novos afastamentos com `status: 'APPROVED'` (linha 311), mas os registros que foram criados **antes** dessa correção ainda estão com `status: 'PENDING'` no banco de dados. Por isso o PDF mostra "Pendente".

### Solução

Executar uma migração SQL para atualizar todos os leaves criados por admins que ainda estão com status `PENDING` para `APPROVED`.

### Alteração

#### Migração SQL

```sql
UPDATE leaves 
SET status = 'APPROVED', updated_at = now() 
WHERE status = 'PENDING' 
  AND admin_id IS NOT NULL;
```

Isso atualiza todos os afastamentos registrados por admins (que têm `admin_id` preenchido) de PENDING para APPROVED.

### Escopo
| Alteração | Detalhe |
|-----------|---------|
| Migração SQL | UPDATE leaves com admin_id de PENDING → APPROVED |

