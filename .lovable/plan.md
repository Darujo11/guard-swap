

## Plano: Mostrar cores das outras equipes nos dias trocados

### Problema
Atualmente, quando um dia é recebido por troca, ele aparece com a cor da própria equipe do segurança. O correto é mostrar a cor da equipe original daquele plantão (a equipe do outro segurança), junto com o nome da equipe.

### Alteração

**Arquivo:** `src/components/schedule/GuardPersonalCalendar.tsx`

1. **Lógica de swap (linhas 99-129):** Quando o segurança recebe um dia por troca, usar a cor e nome da equipe do OUTRO segurança (não da própria):
   - Se sou requester: buscar o `team_id` do target nos dados do swap, e usar a cor/nome dessa equipe
   - Se sou target: buscar o `team_id` do requester nos dados do swap, e usar a cor/nome dessa equipe

2. **Visual do calendário (linhas 206-222):** Adicionar o nome da equipe como tooltip ou texto pequeno nos dias que têm plantão, especialmente nos dias trocados.

3. **Legenda (linhas 170-184):** Gerar legenda dinâmica mostrando todas as equipes que aparecem no calendário (a própria + qualquer equipe de dias trocados), cada uma com sua cor e nome.

4. **Busca de dados do swap:** O fetch atual já traz `requester` e `target` com `team_id`. Usar o `allTeams` para resolver a cor/nome da equipe do outro segurança.

### Resultado
- Dia normal: cor da equipe do segurança
- Dia recebido por troca: cor da equipe original (do outro segurança) + nome da equipe visível
- Legenda mostra todas as equipes presentes no calendário

