

## Plano: Adicionar campo de minutos ao cadastro de plantão extra

### Problema atual
O campo "Horas de Extras Concedido" aceita apenas números inteiros (horas). Não é possível registrar minutos (ex: 12h30min).

### Solução
Adicionar um campo de **minutos** (0-59) ao lado do campo de horas, e uma nova coluna `minutes` na tabela `extras`. A exibição será no formato `24h30min` em vez de `24h`.

### Alterações

#### 1. Migração SQL
```sql
ALTER TABLE extras ADD COLUMN minutes integer NOT NULL DEFAULT 0;
```

#### 2. `src/pages/AdminExtras.tsx`

**States**: Adicionar `minutes` e `editMinutes` (default 0)

**Formulário de cadastro** (~linha 1452): Trocar o input único por dois campos lado a lado:
- Horas (input number, min 0)
- Minutos (input number, min 0, max 59)

**Formulário de edição** (~linha 2222): Mesmo layout

**Insert/Update**: Incluir `minutes` no objeto de insert e update

**Validação**: Horas + minutos deve ser > 0

**Exibição em tabelas e rankings**: Criar helper `formatHoursMinutes(hours, minutes)` que retorna:
- `24h` quando minutes = 0
- `24h30min` quando minutes > 0

**Totais nos rankings**: Somar horas e minutos corretamente (acumular minutos, converter excedente em horas)

**Reset**: Após submit, resetar minutos para 0

#### Locais de exibição a atualizar
- Ranking expandido (~linha 1745): `{extra.quantity}h` → `formatHoursMinutes()`
- Detalhes tabela (~linha 1913): `{extra.quantity || 1}` → formato com minutos
- Ranking total (~linha 1720): `{item.totalHours}h` → formato com total convertido
- Gráficos: tooltip com formato correto
- PDF export: incluir minutos

### Escopo
| Alteração | Detalhe |
|-----------|---------|
| Migração SQL | Coluna `minutes` na tabela `extras` |
| `src/pages/AdminExtras.tsx` | Campo minutos nos formulários, helper de formatação, totais com minutos |

