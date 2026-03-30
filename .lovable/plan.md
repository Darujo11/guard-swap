

## Plano: Ranking de Extras abaixo de "Cadastrar Plantão Extra" com todos os meses acumulados

### Situação atual

A página AdminExtras usa Tabs com duas abas: "Cadastro de Extras" e "Ranking de Extras". O ranking fica escondido na segunda aba. O estado `rankingAllMonths` inicia como `false` (mês específico).

### O que será feito

1. Remover o sistema de Tabs — mostrar tudo em uma única página
2. Mover o card "Ranking de Extras com Filtros" (linhas 1610-1965) para logo após o card "Cadastrar Plantão Extra" (após ~linha 1608, antes dos "Registros Detalhados")
3. Inicializar `rankingAllMonths` como `true` para já mostrar todos os meses acumulados por padrão
4. Mover o conteúdo da tab "ranking" (linhas 1968-2265) para dentro do fluxo principal, removendo o wrapper `TabsContent`

### Alterações

#### `src/pages/AdminExtras.tsx`

| Mudança | Detalhe |
|---------|---------|
| Remover `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` wrappers | Exibir tudo sequencialmente sem abas |
| Linha 130: `rankingAllMonths` | Mudar default de `false` para `true` |
| Reordenar seções | 1) Preferência no Extra → 2) Cadastrar Plantão Extra → 3) Ranking de Extras (filtros + tabela + gráfico) → 4) Registros Detalhados + PDF |

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminExtras.tsx` | Remover Tabs, reordenar seções, `rankingAllMonths` default `true` |

