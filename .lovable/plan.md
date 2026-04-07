
## Plano: Corrigir abril para seguir março

### Diagnóstico
- O problema restante está nos dados de abril já gravados em `team_schedules`.
- A continuidade correta de março é:
```text
31/03 = Equipe B
01/04 = Equipe C
02/04 = Equipe D
03/04 = Equipe A
04/04 = Equipe B
... seguindo C → D → A → B
```
- Hoje abril está quebrado em 6 datas:
  - `12/04`
  - `14/04`
  - `19/04`
  - `21/04`
  - `24/04`
  - `29/04`
- Essas datas formam 3 pares típicos de trocas antigas que foram refletidas na escala-base:
  - `12 ↔ 29`
  - `14 ↔ 21`
  - `19 ↔ 24`

### O que vou fazer
1. Corrigir os dados de abril no banco
   - Recalcular `2026-04-01` até `2026-04-30` pela rotação fixa, continuando a lógica de março.
   - Aplicar a correção por `shift_date`, para deixar o mês inteiro consistente e não depender dos `id`s atuais.

2. Blindar o calendário do admin
   - Ajustar `TeamScheduleCalendar` para carregar apenas as escalas das equipes da organização atual.
   - Hoje ele busca o mês inteiro sem filtrar por equipe/admin, o que é arriscado para multi-admin.

3. Blindar a geração manual de padrão
   - Revisar `generatePattern24_72()` em `TeamScheduleCalendar`.
   - Hoje ele reinicia o ciclo a partir do mês aberto, o que pode quebrar a continuidade com março.
   - Vou alinhar essa geração com a mesma regra fixa da rotação, ou remover esse atalho se ele estiver conflitante com a regra oficial.

4. Manter trocas apenas em “Minha Escala”
   - Preservar a lógica já aprovada: trocas aprovadas continuam aparecendo só no calendário pessoal via `computeEffectiveSchedule`.
   - O calendário de equipes permanece como escala-base pura.

### Arquivos envolvidos
- `src/components/schedule/TeamScheduleCalendar.tsx`
- `src/pages/AdminSchedule.tsx`
- `src/utils/swapScheduleUpdate.ts` (limpeza opcional de legado)

### Resultado esperado para abril
```text
01 C  02 D  03 A  04 B
05 C  06 D  07 A  08 B
09 C  10 D  11 A  12 B
13 C  14 D  15 A  16 B
17 C  18 D  19 A  20 B
21 C  22 D  23 A  24 B
25 C  26 D  27 A  28 B
29 C  30 D
```

### Observação técnica
- Não precisa mudança de estrutura no banco.
- É uma correção de dados em `team_schedules` + ajuste no frontend para não voltar a quebrar.
