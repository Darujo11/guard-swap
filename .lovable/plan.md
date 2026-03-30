

## Plano: Botão "Bloquear Trocas" no dropdown Minha Conta

### O que será feito

Adicionar um toggle "Bloquear Trocas" no dropdown "Minha Conta" do admin, abaixo de "Troca só dentro do mês". Quando ativo, os seguranças não conseguirão solicitar trocas — o formulário exibirá uma mensagem de bloqueio.

### Alterações

#### 1. Migração SQL — nova coluna

```sql
ALTER TABLE organization_settings 
ADD COLUMN swaps_blocked boolean NOT NULL DEFAULT false;
```

#### 2. `src/hooks/useOrganizationSettings.tsx`

- Adicionar `swaps_blocked: boolean` à interface e `swaps_blocked: false` ao `defaultSettings`

#### 3. `src/components/layout/AppLayout.tsx`

- Importar `ShieldOff` (ou `Ban`) do lucide-react
- Após o item "Troca só dentro do mês" (linha 208), adicionar novo `DropdownMenuItem` visível apenas para admin/super_admin
- Texto: "Bloquear Trocas" com badge "Ativo" quando `settings.swaps_blocked === true`
- Ao clicar: `updateSettings({ swaps_blocked: !settings.swaps_blocked })`

#### 4. `src/components/guards/GuardSwapForm.tsx`

- Já importa `useOrganizationSettings`
- No início do componente, verificar `settings.swaps_blocked`
- Se bloqueado, renderizar um Card com mensagem "Trocas bloqueadas no sistema pelo coordenador" em vez do formulário

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Nova coluna `swaps_blocked` em `organization_settings` |
| `src/hooks/useOrganizationSettings.tsx` | Campo na interface e defaults |
| `src/components/layout/AppLayout.tsx` | Toggle no dropdown |
| `src/components/guards/GuardSwapForm.tsx` | Bloquear formulário quando ativo |

