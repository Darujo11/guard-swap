

## Plano: Remover "Avaliação Simulador" do menu de navegação admin

### Alteração

**Arquivo:** `src/components/layout/AppLayout.tsx`

Remover o item de navegação "Avaliação Simulador" do array `navigation` (linhas 50-55).

As rotas em `App.tsx` e as páginas `EvaluationSimulator.tsx` / `EvaluationHistory.tsx` permanecem — apenas o link no menu lateral será removido.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppLayout.tsx` | Remover item `Avaliação Simulador` do array `navigation` |

