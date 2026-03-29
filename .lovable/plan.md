

## Plano: Mostrar letra da equipe e nome do antigo dono nos dias trocados

### Alterações

#### 1. `src/utils/effectiveSchedule.ts` — Adicionar campos ao `EffectiveDay`

Novos campos na interface:
- `originalTeamName?: string` — nome da equipe original (ex: "Equipe D")
- `originalOwnerName?: string` — nome do segurança que era dono do dia (ex: "Reginaldo")
- `originalDate?: string` — data que o outro segurança fez a troca

No `computeEffectiveSchedule`, os swaps já trazem `requester.name` e `target.name`. Ao criar o dia trocado:
- Se é requester: `originalOwnerName = swap.target.name`, `originalTeamName = otherTeam.name`
- Se é target: `originalOwnerName = swap.requester.name`, `originalTeamName = otherTeam.name`

Atualizar o tipo do parâmetro `approvedSwaps` para incluir `name` em `requester` e `target` (já vem do fetch).

#### 2. `src/components/schedule/GuardPersonalCalendar.tsx` — Renderização dos dias trocados

Aumentar altura das células de `h-12` para `h-16` (para caber mais info nos dias trocados).

Para dias trocados, mostrar:
- Número do dia
- Primeira letra da equipe (ex: "A" extraída de "Equipe A")
- Nome do antigo dono em fonte pequena (ex: "Reginaldo")

Para dias normais, manter como está (número + nome da equipe).

Layout do dia trocado:
```text
┌─────────┐
│  30   ↔ │
│    A    │
│Reginaldo│
└─────────┘
```

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/utils/effectiveSchedule.ts` | Adicionar `originalTeamName`, `originalOwnerName` à interface e ao cálculo |
| `src/components/schedule/GuardPersonalCalendar.tsx` | Renderizar letra da equipe + nome do antigo dono nos dias trocados |

