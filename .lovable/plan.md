

## Plano: Mostrar todos os afastamentos no calendário do segurança

### Situação atual

O calendário pessoal (`GuardPersonalCalendar.tsx`) só busca folgas do tipo `TRE` com status `APPROVED`. Outros afastamentos (Atestado, Férias, Licença, Falta, etc.) não aparecem.

### O que será feito

Expandir a busca de `leaves` para incluir **todos os tipos de afastamento** (não apenas TRE), e exibir cada dia de afastamento em vermelho no calendário com o nome abreviado do tipo.

### Alterações em `src/components/schedule/GuardPersonalCalendar.tsx`

1. **Estado**: Trocar `treApprovedDates` (Set de strings) por `leaveDates` (Map de string → tipo do afastamento)
   - Tipo: `Map<string, string>` onde key = data, value = label legível (ex: "Atestado", "Férias", "TRE", "Licença-Nojo")

2. **Query** (linhas 70-77): Remover `.eq('leave_type', 'TRE')` para buscar todos os tipos. Também buscar `leave_type` e `custom_type`. Expandir datas entre `start_date` e `end_date` para cobrir afastamentos multi-dia.

3. **Processamento**: Para cada leave, gerar todas as datas entre `start_date` e `end_date` e inserir no Map com o label do tipo.

4. **Legenda** (linhas 213-218): Substituir "Folga TRE" por uma legenda dinâmica que agrupa por tipo de afastamento encontrado no mês.

5. **Renderização dos dias** (linhas 244, 256-283): Substituir `isTreLeave` por verificação no `leaveDates` Map, exibir o tipo abreviado no dia (ex: "Atestado", "Férias", "TRE").

6. **PDF** (`pdfGenerator.ts`): O `treApprovedDates` passado ao PDF será substituído pelo Map completo — ajustar a interface para aceitar o novo formato.

### Mapeamento de tipos para labels

```text
TRE           → "TRE"
ATESTADO      → "Atestado"
FERIAS        → "Férias"
LICENCA_NOJO  → "Lic. Nojo"
LICENCA_PATERNIDADE → "Lic. Pat."
LICENCA_NAO_REMUNERADA → "Lic. N/R"
FALTA_INJUSTIFICADA → "Falta"
OUTRO         → custom_type ou "Afastamento"
```

### Escopo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/schedule/GuardPersonalCalendar.tsx` | Buscar todos os leaves, Map com tipo, legenda dinâmica, renderização por tipo |
| `src/utils/pdfGenerator.ts` | Aceitar Map com tipo em vez de Set, exibir tipo no PDF |

