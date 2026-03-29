

## Plano: Incluir folgas TRE no PDF da escala

### O que será feito

Quando o segurança exportar o PDF da escala, os dias com folga TRE aprovada aparecerão com fundo vermelho e observação "Folga TRE".

### Alterações

#### 1. `src/components/schedule/GuardPersonalCalendar.tsx`

Passar `treApprovedDates` como novo parâmetro ao chamar `generateSchedulePDF`:

```ts
generateSchedulePDF(guardName || 'Segurança', teamName, monthLabel, workingDays, extrasMap, treApprovedDates);
```

#### 2. `src/utils/pdfGenerator.ts`

- Adicionar parâmetro `treDates?: Set<string>` na assinatura de `generateSchedulePDF`
- Incluir datas TRE no `allDates` (para aparecerem mesmo que não sejam dia de plantão)
- Para dias com TRE: coluna Equipe = "FOLGA TRE", observação = "Folga TRE"
- No `didParseCell`: linhas com "FOLGA TRE" recebem fundo vermelho (`[220, 38, 38]`) e texto branco

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/components/schedule/GuardPersonalCalendar.tsx` | Passar `treApprovedDates` ao `generateSchedulePDF` |
| `src/utils/pdfGenerator.ts` | Novo parâmetro `treDates`, renderizar linhas TRE em vermelho |

