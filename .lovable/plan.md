

## Plano: Incluir datas da troca na observação do PDF

### Problema
A observação atual mostra apenas "Troca com Reginaldo (Equipe D)". Falta indicar os dias envolvidos (ex: "dia 03/04 ↔ 30/04").

### Alterações

#### 1. `src/utils/effectiveSchedule.ts` — Adicionar `originalDate` ao `EffectiveDay`

- Novo campo: `originalDate?: string` (a data que o segurança cedeu na troca)
- Para requester: `originalDate = requester_shift_date` (dia que cedeu)
- Para target: `originalDate = target_shift_date` (dia que cedeu)

#### 2. `src/utils/pdfGenerator.ts` — Atualizar observação

Atualizar a tipagem do parâmetro `workingDays` para incluir `originalDate`.

Alterar a linha de observação de troca de:
```
Troca com Reginaldo (Equipe D)
```
Para:
```
Troca com Reginaldo (Equipe D) — dias 03/04 ↔ 30/04
```

Onde o primeiro dia é o `originalDate` (dia cedido) e o segundo é o `dateStr` (dia recebido), ambos formatados dd/MM.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/utils/effectiveSchedule.ts` | Adicionar campo `originalDate` à interface e ao cálculo |
| `src/utils/pdfGenerator.ts` | Incluir datas na observação de troca |

