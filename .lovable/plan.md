

## Plano: Marcar dias de trabalho do segurança nos calendários de Data Inicial e Data Final

### O que será feito

Quando o admin selecionar um segurança e abrir o calendário de "Data Inicial" ou "Data Final", os dias de trabalho (plantões) daquele segurança serão destacados visualmente (com a cor da equipe como fundo), facilitando a escolha.

### Alterações em `src/pages/AdminLeaves.tsx`

1. **Interface Guard**: Adicionar `team_id` ao tipo e à query (`fetchGuards`)

2. **Novo estado e fetch**: Quando `selectedGuard` mudar, buscar:
   - O `team_id` e `color` da equipe do segurança selecionado
   - Os `team_schedules` dessa equipe (todos os meses disponíveis)
   - Os `swap_requests` aprovados envolvendo esse segurança
   - Computar a escala efetiva com `computeEffectiveSchedule` e armazenar como `Set<string>` de datas de trabalho

3. **Calendários**: Usar a prop `modifiers` e `modifiersClassNames` (ou `modifiersStyles`) do componente `Calendar` (react-day-picker) para aplicar um estilo visual (fundo colorido com a cor da equipe) nos dias que são plantões do segurança selecionado

4. **CSS**: Adicionar classe ou inline style para destacar dias de trabalho (círculo com cor da equipe, texto claro)

### Fluxo
```text
Admin seleciona segurança → fetch team_schedules + swaps → computeEffectiveSchedule → Set de datas
Calendar recebe modifiers={{ workDay: (date) => workDaysSet.has(format(date)) }}
modifiersStyles={{ workDay: { backgroundColor: teamColor, color: 'white', borderRadius: '50%' } }}
```

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminLeaves.tsx` | Buscar escala do segurança selecionado, destacar dias de trabalho nos 2 calendários |

