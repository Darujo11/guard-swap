

## Plano: Mostrar plantões cedidos em cinza claro com nome do substituto

### Problema
Quando o segurança faz uma troca, o dia que ele cedeu simplesmente desaparece do calendário pessoal. O usuário quer ver esse dia em cinza claro com o nome da pessoa que vai cobrir aquele plantão.

### Solução

**1. Alterar `computeEffectiveSchedule` em `src/utils/effectiveSchedule.ts`**
- Em vez de `days.delete()` no dia cedido, manter o dia no Map com um novo campo `isGivenAway: true` e o nome de quem ficou com o plantão (`coveredByName`).
- Adicionar os campos `isGivenAway` e `coveredByName` à interface `EffectiveDay`.

**2. Alterar o calendário em `src/components/schedule/GuardPersonalCalendar.tsx`**
- Dias com `isGivenAway: true`: fundo cinza claro (`#D1D5DB`), texto escuro, exibir o primeiro nome da pessoa que vai cobrir.
- Adicionar item na legenda dinâmica para "Cedido".

### Detalhes da interface atualizada

```text
interface EffectiveDay {
  ...campos existentes...
  isGivenAway?: boolean;
  coveredByName?: string;
}
```

### Lógica de troca atualizada

```text
Se é requester:
  - Marca requester_shift_date como { isGivenAway: true, coveredByName: target.name }
  - Adiciona target_shift_date como dia recebido (isSwapped: true)

Se é target:
  - Marca target_shift_date como { isGivenAway: true, coveredByName: requester.name }
  - Adiciona requester_shift_date como dia recebido (isSwapped: true)
```

### Visual no calendário

```text
┌─────┐  ┌─────┐
│ 15  │  │ 18  │
│cinza│  │verde│
│João │  │Troca│
└─────┘  └─────┘
  ↑ cedido    ↑ recebido
```

### Arquivos alterados
- `src/utils/effectiveSchedule.ts` — interface + lógica
- `src/components/schedule/GuardPersonalCalendar.tsx` — renderização + legenda

