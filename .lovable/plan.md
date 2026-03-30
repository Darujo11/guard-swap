

## Plano: Adicionar botão "Atualizar Sistema" no dropdown "Minha Conta"

### O que será feito

Adicionar um item "Atualizar Sistema" com ícone `RefreshCw` no dropdown de "Minha Conta", logo abaixo do item "Perfil", com a mesma lógica de limpar cache do SW e recarregar.

### Alteração

#### `src/components/layout/AppLayout.tsx`

- Importar `RefreshCw` do lucide-react
- Após o `DropdownMenuItem` do "Perfil" (linha 197), adicionar novo `DropdownMenuItem` com ícone `RefreshCw` e texto "Atualizar Sistema"
- Lógica `onSelect`: limpar service workers, limpar caches, `window.location.reload()`

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppLayout.tsx` | Novo item "Atualizar Sistema" no dropdown após "Perfil" |

