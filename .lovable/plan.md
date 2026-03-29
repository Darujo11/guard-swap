

## Plano: Adicionar botão "Ver Escala" nas ações de cada segurança

### Alteração

**Arquivo:** `src/pages/AdminGuards.tsx`

1. Adicionar estado para controlar o dialog de escala (`selectedGuardForSchedule`) e um `Dialog` que renderiza o `GuardPersonalCalendar`.

2. Na coluna "Ações" da tabela de seguranças cadastrados (linha ~808), adicionar um botão com ícone de calendário (`CalendarIcon`) antes do botão de ficha. Ao clicar, abre um Dialog com o `GuardPersonalCalendar` do segurança selecionado.

3. Importar `GuardPersonalCalendar` e o ícone `Calendar` do lucide-react.

### Detalhes técnicos

- Novo estado: `const [selectedGuardForSchedule, setSelectedGuardForSchedule] = useState<Profile | null>(null)`
- O `GuardPersonalCalendar` recebe `guardId`, `teamId`, `teamColor` e `teamName` — todos disponíveis no objeto `guard` da tabela.
- Dialog controlado por `selectedGuardForSchedule !== null`.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminGuards.tsx` | Adicionar estado, dialog e botão de calendário na coluna de ações |

