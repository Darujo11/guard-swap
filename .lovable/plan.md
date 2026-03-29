

## Plano: Cancelar solicitação de folga TRE

### O que será feito

Após solicitar uma folga TRE, exibir abaixo de "Minha Escala" uma lista das folgas TRE pendentes do segurança com botão para cancelar (excluir). Também adicionar uma policy RLS para permitir que guards deletem suas próprias folgas TRE.

### Alterações

#### 1. Migração SQL — Policy de DELETE para guards na tabela `leaves`

```sql
CREATE POLICY "Guards can delete their own TRE leaves"
  ON public.leaves FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'guard'::app_role)
    AND guard_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND leave_type = 'TRE'
  );
```

#### 2. `src/pages/GuardDashboard.tsx`

- Buscar as folgas TRE do segurança (já temos os dados em `fetchTreQuota`, basta guardar os registros completos num novo estado `treLeaves`)
- Adicionar função `handleCancelTreLeave(leaveId)` que faz `supabase.from('leaves').delete().eq('id', leaveId)` e atualiza o saldo
- Abaixo do `GuardPersonalCalendar`, se houver folgas TRE, exibir um card "Folgas TRE Solicitadas" com:
  - Lista dos dias solicitados (formatado dd/MM/yyyy)
  - Botão "Cancelar" (ícone X ou Trash) em cada linha
  - Confirmação via toast ou dialog simples antes de excluir

### Ordem no layout
1. Minha Escala (calendário)
2. **Folgas TRE Solicitadas** (novo card, só aparece se houver folgas TRE)
3. Ranking de Extras (existente)

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Policy de DELETE para guards em `leaves` (apenas TRE) |
| `src/pages/GuardDashboard.tsx` | Estado `treLeaves`, card com lista e botão cancelar |

