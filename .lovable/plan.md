

## Plano: Botão de atualização mais visível na página de Login

### Contexto
Já existe um pequeno ícone de refresh no rodapé da tela de login, mas é discreto. Vamos adicionar um botão mais visível e acessível.

### Alteração

| Arquivo | Detalhe |
|---------|---------|
| `src/pages/Login.tsx` | Substituir o ícone pequeno de refresh no footer por um botão com texto "Atualizar Sistema" visível, com ícone RefreshCw + texto, usando estilo `outline` para destaque sem competir com o botão de login |

O botão executará a mesma lógica existente: desregistrar Service Workers, limpar caches e forçar reload.

