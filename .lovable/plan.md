

## Plano: Calendário Pessoal do Segurança com Reflexo de Trocas

### Problema
Atualmente o calendário mostra apenas a escala por equipe. Quando um segurança troca de plantão, não existe uma visão pessoal que mostre os dias que ele realmente vai trabalhar (incluindo dias recebidos de trocas e excluindo dias cedidos).

### Solução
Criar um componente `GuardPersonalCalendar` que calcula dinamicamente os dias de trabalho do segurança combinando:
1. Dias da escala da sua equipe (`team_schedules`)
2. **Menos** os dias que ele cedeu em trocas aprovadas
3. **Mais** os dias que ele recebeu em trocas aprovadas

Cada dia recebido via troca mostra a cor da equipe do segurança que cedeu (ex: se Fabio da Equipe A recebe o dia 30 do Reginaldo da Equipe D, o dia 30 aparece com cor Azul/Equipe A no calendário do Fabio, e o dia 03 aparece Vermelho/Equipe D no calendário do Reginaldo).

### Não precisa de mudanças no banco de dados
Tudo é calculado a partir de dados existentes: `team_schedules`, `swap_requests` (status APPROVED) e `profiles`/`teams`.

### Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/schedule/GuardPersonalCalendar.tsx` | CRIAR | Calendário pessoal do segurança |
| `src/pages/GuardDashboard.tsx` | MODIFICAR | Adicionar o calendário pessoal na dashboard do segurança |

### Componente `GuardPersonalCalendar`

**Props:** `guardId`, `teamId`, `teamColor`, `teamName`

**Lógica de cálculo:**
```text
1. Buscar team_schedules do mês (onde team_id = meu team_id)
   → Esses são meus dias BASE de trabalho

2. Buscar swap_requests APPROVED onde eu sou requester ou target

3. Para cada swap aprovada:
   - Se sou o requester:
     → Remover requester_shift_date dos meus dias
     → Adicionar target_shift_date (com a cor da equipe do target)
   - Se sou o target:
     → Remover target_shift_date dos meus dias
     → Adicionar requester_shift_date (com a cor da equipe do requester)

4. Renderizar calendário mensal com:
   - Dias normais: cor da minha equipe
   - Dias recebidos por troca: cor da equipe original (do outro segurança)
   - Indicador visual (ícone ↔) nos dias que vieram de troca
```

**Visual:**
- Calendário mensal com navegação por mês
- Dias de trabalho coloridos com a cor da equipe
- Dias recebidos por troca com badge/ícone indicando que foi troca
- Legenda mostrando equipe do segurança e dias de troca

### GuardDashboard
- Adicionar `GuardPersonalCalendar` logo no topo da dashboard, antes dos botões de ação
- Passa os dados do `currentUser` (id, team_id, team color/name)

