

## Plano: Botão de atualização no Login e no Perfil

### O que será feito

Adicionar um botão "Atualizar Sistema" em ambas as páginas que força o reload da aplicação limpando o cache do Service Worker.

### Alterações

#### 1. `src/pages/Login.tsx`

- Adicionar botão "Atualizar" (ícone `RefreshCw`) próximo à versão no rodapé
- Ao clicar: limpar caches do SW (`caches.keys()` + `caches.delete()`) e fazer `window.location.reload()`

#### 2. `src/pages/Profile.tsx`

- Adicionar botão "Atualizar Sistema" com a mesma lógica, posicionado no final da página ou próximo à versão

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Login.tsx` | Botão "Atualizar" no rodapé ao lado da versão |
| `src/pages/Profile.tsx` | Botão "Atualizar Sistema" na página de perfil |

