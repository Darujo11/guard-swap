

## Plano: Botão "Solicitar Folga TRE" no dashboard do segurança

### O que será feito

Adicionar um botão "Solicitar Folga TRE" ao lado de "Ver Escala Completa" no dashboard do segurança. O botão só aparece se o segurança tiver saldo de folgas TRE (quota > 0). Ao clicar, abre um dialog com o calendário pessoal em modo de seleção — o segurança clica no dia desejado e aparece um botão "Solicitar" para confirmar. A solicitação cria um registro na tabela `leaves` com `leave_type = 'TRE'`.

### Alterações

#### 1. `src/pages/GuardDashboard.tsx`

- Buscar a quota TRE do segurança (`guard_tre_quotas`) e as folgas TRE já usadas (`leaves` com `leave_type = 'TRE'`)
- Calcular saldo. Se saldo > 0, exibir botão "Solicitar Folga TRE" ao lado dos outros botões
- Ao clicar, abrir um dialog com o `GuardPersonalCalendar` em modo seleção (nova prop `selectionMode`)
- Quando o segurança selecionar um dia, exibir botão "Solicitar Folga" com o dia selecionado
- Ao confirmar, inserir na tabela `leaves` (`guard_id`, `start_date`, `end_date` = mesmo dia, `leave_type = 'TRE'`, `admin_id`)
- Mostrar toast de sucesso e atualizar saldo

#### 2. `src/components/schedule/GuardPersonalCalendar.tsx`

- Adicionar props opcionais: `selectionMode?: boolean`, `selectedDate?: string | null`, `onDateSelect?: (date: string) => void`
- Quando `selectionMode = true`, ao clicar num dia do calendário, chamar `onDateSelect` com a data clicada e destacar o dia selecionado com um ring/borda especial

### Fluxo do usuário
1. Segurança vê botão "Solicitar Folga TRE (Saldo: X)" se tiver quota
2. Clica → abre dialog com calendário
3. Clica no dia desejado → dia fica destacado + botão "Solicitar Folga" aparece
4. Confirma → registro criado, saldo atualizado, dialog fecha

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GuardDashboard.tsx` | Buscar quota TRE, botão condicional, dialog com calendário selecionável, inserção na tabela leaves |
| `src/components/schedule/GuardPersonalCalendar.tsx` | Props de seleção, clique nos dias, destaque do dia selecionado |

