

## Plano: Mover botão "Atualizar Sistema" para logo abaixo do card de Perfil

### O que será feito

Mover o botão "Atualizar Sistema" de sua posição atual (abaixo do card de Segurança/senha) para logo abaixo do card "Informações do Perfil", antes do card de senha.

### Alteração

#### `src/pages/Profile.tsx`

- Remover o `<div>` com o botão "Atualizar Sistema" do final da página (linhas 322-340)
- Inserir esse mesmo botão logo após o card "Informações do Perfil" (após linha 267), antes do card "Segurança"

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Profile.tsx` | Reposicionar botão "Atualizar Sistema" para após o card de perfil |

