
## Plano: Corrigir calendário que fica em branco ao trocar de mês

### Diagnóstico
- Não parece ser um crash de JavaScript.
- O problema veio da última mudança no `TeamScheduleCalendar`: ao trocar o mês, a busca passa a filtrar `team_schedules` por `admin_id`.
- Os registros antigos de escala ainda estão com `admin_id = null`, então a consulta volta vazia e o calendário parece “em branco”.
- Além disso, a navegação do mês usa `addDays(±30)`, o que não representa mudança real de mês e pode causar saltos incorretos.

### O que vou corrigir
1. **Corrigir os dados antigos no banco**
   - Preencher `team_schedules.admin_id` com o `admin_id` da equipe correspondente (`teams.admin_id`) em todos os registros legados que hoje estão nulos.

2. **Blindar o carregamento do calendário**
   - Ajustar `src/components/schedule/TeamScheduleCalendar.tsx` para só buscar escalas depois que o `profile` estiver carregado.
   - Incluir `profile`/estado de auth nas dependências do `useEffect`, para evitar a primeira busca sem escopo.

3. **Corrigir a troca de mês**
   - Substituir `addDays(currentMonth, ±30)` por navegação real com `addMonths` e `subMonths`.

4. **Melhorar a percepção visual**
   - Adicionar estado de carregamento do calendário ao mudar de mês, para não parecer tela vazia enquanto busca os dados.

5. **Revisar escopo das ações**
   - Garantir que leituras e operações de geração/remoção de escala nesse componente continuem limitadas à organização do admin atual.

### Arquivos envolvidos
- `src/components/schedule/TeamScheduleCalendar.tsx`
- `supabase/migrations/...sql`

### Detalhe técnico
SQL de correção:
```sql
update public.team_schedules ts
set admin_id = t.admin_id
from public.teams t
where ts.team_id = t.id
  and ts.admin_id is null
  and t.admin_id is not null;
```

Ajuste no componente:
```ts
const { profile, loading: authLoading } = useAuth();

useEffect(() => {
  if (authLoading || !profile) return;
  // carregar dados do mês com escopo correto
}, [currentMonth, authLoading, profile?.id, profile?.admin_id]);
```

Navegação:
```ts
setCurrentMonth(prev => subMonths(prev, 1));
setCurrentMonth(prev => addMonths(prev, 1));
```

### Resultado esperado
- Ao trocar para abril, maio, junho etc., a escala continua aparecendo normalmente.
- O calendário passa a navegar mês a mês corretamente.
- O problema não volta a acontecer por causa de registros antigos com `admin_id` vazio.
