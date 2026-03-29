

## Plano: Botão de download PDF na escala do segurança

### O que será feito

Adicionar um botão "Baixar PDF" no header do `GuardPersonalCalendar`. Ao clicar, gera um PDF com:
- Nome do segurança, equipe e mês de referência
- Tabela com todos os dias de plantão do mês
- Coluna indicando se o dia foi trocado, com quem e de qual equipe original

### Alterações

#### 1. `src/utils/pdfGenerator.ts` — Nova função `generateSchedulePDF`

Adicionar função que recebe:
- `guardName`, `teamName`, `monthLabel`
- `workingDays: Map<string, EffectiveDay>`

Gera PDF com:
- Header: "Escala de [nome] — [mês/ano]"
- Equipe: [nome da equipe]
- Tabela via `autoTable`: colunas `Data`, `Equipe`, `Observação`
  - Data formatada dd/MM/yyyy
  - Equipe: nome da equipe do dia
  - Observação: se `isSwapped`, texto "Troca com [originalOwnerName] (Equipe [originalTeamName])", senão vazio
- Footer com página e sistema

#### 2. `src/components/schedule/GuardPersonalCalendar.tsx` — Botão de download

- Adicionar prop opcional `guardName?: string` para exibir no PDF
- Importar `Download` do lucide-react e a nova função `generateSchedulePDF`
- Adicionar botão no header (ao lado dos controles de mês)
- Ao clicar, chama `generateSchedulePDF` passando os dados do `workingDays` atual

#### 3. `src/pages/AdminGuards.tsx` — Passar `guardName` ao `GuardPersonalCalendar`

Passar o nome do segurança selecionado como prop para o calendário no dialog.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/utils/pdfGenerator.ts` | Nova função `generateSchedulePDF` |
| `src/components/schedule/GuardPersonalCalendar.tsx` | Adicionar botão download + prop `guardName` |
| `src/pages/AdminGuards.tsx` | Passar `guardName` ao componente |

