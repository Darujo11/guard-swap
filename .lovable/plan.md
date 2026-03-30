

## Plano: Botão "Troca só dentro do mês" no dropdown Minha Conta

### O que será feito

Adicionar um toggle no dropdown "Minha Conta" (abaixo de "Perfil") que permite ao admin ativar/desativar a restrição de trocas apenas dentro do mesmo mês. Quando ativo, os seguranças só poderão solicitar trocas em que ambas as datas estejam no mesmo mês.

### Alterações

#### 1. Migração SQL — nova coluna na tabela `organization_settings`

```sql
ALTER TABLE organization_settings 
ADD COLUMN swap_same_month_only boolean NOT NULL DEFAULT false;
```

#### 2. `src/hooks/useOrganizationSettings.tsx`

- Adicionar `swap_same_month_only: boolean` à interface `OrganizationSettings`
- Adicionar default `swap_same_month_only: false` ao `defaultSettings`

#### 3. `src/components/layout/AppLayout.tsx`

- Importar `useOrganizationSettings` (já disponível via import existente)
- Após o item "Perfil" no dropdown, adicionar um `DropdownMenuItem` com ícone `Calendar` e texto "Troca só dentro do mês"
- Mostrar um indicador visual (badge ou check) quando ativo
- Ao clicar, chamar `updateSettings({ swap_same_month_only: !settings.swap_same_month_only })`
- Mostrar apenas para role `admin` ou `super_admin`

#### 4. `src/components/guards/GuardSwapForm.tsx`

- Importar `useOrganizationSettings`
- Na função `validateSwapDates`, quando `settings.swap_same_month_only === true`, verificar se `requesterDate` e `targetDate` têm o mesmo mês/ano
- Se não tiverem, exibir toast "As trocas só são permitidas dentro do mesmo mês" e retornar `false`

### Escopo

| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Nova coluna `swap_same_month_only` em `organization_settings` |
| `src/hooks/useOrganizationSettings.tsx` | Adicionar campo à interface e defaults |
| `src/components/layout/AppLayout.tsx` | Toggle no dropdown "Minha Conta" |
| `src/components/guards/GuardSwapForm.tsx` | Validação de mesmo mês na criação de troca |

