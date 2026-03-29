

## Plano: Mostrar dias de Extra no calendário e no PDF

### O que será feito

1. Buscar os registros de `extras` do segurança no mês atual
2. Exibir no calendário os dias de extra com cor dourada e texto "Extra"
3. No PDF, incluir os dias de extra com a justificação na coluna "Observação"

### Alterações

#### 1. `src/components/schedule/GuardPersonalCalendar.tsx`

- Adicionar estado `extras` para armazenar os registros de extras do mês
- No `fetchData`, buscar extras do segurança: `supabase.from('extras').select('*').eq('guard_id', guardId).gte('extra_date', monthStart).lte('extra_date', monthEnd)`
- Criar um `Map<string, { justification: string; percentage_type: number }>` com os extras por data (`extra_date`)
- Na renderização do calendário, para dias que existem no mapa de extras (mesmo que não sejam dia de plantão):
  - Cor de fundo dourada (`#B8860B` ou similar)
  - Texto "Extra" dentro da célula
- Na legenda, adicionar item dourado "Extra" se houver extras no mês
- Ao gerar PDF, passar os extras junto com os `workingDays`

#### 2. `src/utils/pdfGenerator.ts`

- Atualizar a assinatura de `generateSchedulePDF` para aceitar um parâmetro opcional `extras: Map<string, { justification: string; percentage_type: number }>`
- Após os dias de plantão na tabela, adicionar linhas para cada dia de extra (com cor ou indicação "EXTRA" na coluna Equipe)
- Na coluna Observação: mostrar a justificação do extra (ex: "Extra 100% — Cobertura de falta")
- Ordenar todas as linhas por data (plantão + extras juntos)

#### 3. Renderização no calendário

Para cada dia do calendário, verificar:
1. Se é dia de plantão (workingDays) → renderizar como antes
2. Se é dia de extra (extrasMap) → renderizar com fundo dourado + "Extra"
3. Se é ambos → renderizar com plantão normal + indicador de extra (estrela ou badge)

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/components/schedule/GuardPersonalCalendar.tsx` | Buscar extras, renderizar dias dourados, passar extras ao PDF |
| `src/utils/pdfGenerator.ts` | Aceitar extras e incluir no PDF com justificação |

