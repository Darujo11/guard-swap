
## Plano: Corrigir PDF completo por mês (filtro respeitado)

### Diagnóstico rápido
- O PDF completo busca `team_schedules` com `.eq('admin_id', profile.id)`.
- Parte das escalas foi criada sem `admin_id` (ou com outro valor), então os dias base não entram.
- Resultado: PDF sai com poucos dias (normalmente só trocas/extras/TRE), diferente do mês filtrado.
- Também existe risco de deslocamento de dia em TRE por uso de `toISOString()` (UTC).

### O que vou ajustar

1) **Corrigir a origem da escala base** (`src/pages/AdminGuards.tsx`)
- Em `handleGenerateAllPDF`, buscar `team_schedules` por:
  - `team_id` das equipes do admin (array de `teams` da tela),
  - intervalo do mês selecionado (`startOfMonth` a `endOfMonth`).
- Remover dependência de `admin_id` para essa consulta de escalas.

2) **Filtrar trocas pelo mês selecionado**
- Restringir `swap_requests` aprovadas para trocas que impactam o mês (data do requester ou target no intervalo).
- Manter a aplicação de `computeEffectiveSchedule`, agora com dados corretos do mês.

3) **Ajustar geração de datas TRE para timezone local**
- Trocar `d.toISOString().split('T')[0]` por `format(d, 'yyyy-MM-dd')` ao expandir período TRE.
- Evita perder/incluir dia errado por UTC-3.

4) **Consolidar consistência do filtro mensal**
- Validar `pdfMonth` antes de gerar.
- Garantir que `start/end/monthLabel` venham da mesma referência de mês.
- Manter layout/estrutura do `generateAllGuardsSchedulePDF` sem mudanças visuais.

5) **Validação funcional**
- Testar meses diferentes (ex.: março e abril) com:
  - escala base + trocas + extras + TRE.
- Conferir se o PDF contém somente os dias do mês selecionado e com quantidade correta.

### Escopo
| Arquivo | Alteração |
|---|---|
| `src/pages/AdminGuards.tsx` | Correção de consultas e filtros de dados usados na geração do PDF completo |

### Detalhes técnicos
- O defeito está no **dataset** enviado ao PDF, não na biblioteca `jsPDF`.
- A correção alinha o PDF completo ao mesmo princípio da escala efetiva: base da equipe + trocas aprovadas + corte por mês.
