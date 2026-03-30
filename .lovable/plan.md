

## Plano: Manter dropdown aberto ao clicar nos toggles

### O que será feito

Impedir que o dropdown feche ao clicar em "Troca só dentro do mês" e "Bloquear Trocas", usando `e.preventDefault()` no `onSelect`.

### Alteração

#### `src/components/layout/AppLayout.tsx`

- Linha 200: Mudar `onSelect={() => {` para `onSelect={(e) => { e.preventDefault();`
- Linha 211: Mudar `onSelect={() => {` para `onSelect={(e) => { e.preventDefault();`

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppLayout.tsx` | `e.preventDefault()` nos dois `DropdownMenuItem` de toggle |

