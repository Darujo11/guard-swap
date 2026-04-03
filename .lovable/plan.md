

## Plano: Registrar folgas TRE retroativas (pré-sistema)

### Problema
O sistema só conta como "usadas" as folgas TRE registradas dentro do sistema. Folgas tiradas antes da implantação não são contabilizadas. O admin precisa informar quantas já foram usadas historicamente.

### Solução
Adicionar um campo "Folgas já tiradas" (`pre_used_days`) na tabela `guard_tre_quotas` para registrar o uso histórico. A tabela de saldos passará a somar esse valor com as folgas registradas no sistema.

### Alterações

| Componente | Detalhe |
|------------|---------|
| **Migração DB** | Adicionar coluna `pre_used_days integer NOT NULL DEFAULT 0` à tabela `guard_tre_quotas` |
| **AdminLeaves.tsx** | Adicionar campo "Já tiradas (retroativo)" ao formulário de cotas TRE, salvar/carregar o novo campo |
| **AdminLeaves.tsx** | Na tabela de saldos, a coluna "Usadas" passa a ser `pre_used_days + dias registrados no sistema`. Adicionar sub-colunas ou tooltip para distinguir retroativas vs sistema |
| **GuardDashboard.tsx** | Incluir `pre_used_days` no cálculo de TRE usadas do segurança |

### Fluxo do formulário

```text
[Segurança ▼]  [Total de Afastamentos: 21]  [Já tiradas (antes do sistema): 8]  [Salvar]
```

### Tabela de saldos (atualizada)

```text
Segurança     | Total TRE | Retroativas | No Sistema | Total Usadas | Saldo
Carlos Almeida|    21     |      8      |     2      |     10       |  11
```

### Detalhes técnicos
- A coluna `pre_used_days` terá default 0, sem impacto nos dados existentes
- O cálculo de saldo será: `total_days - pre_used_days - dias_no_sistema`
- O state `treQuotas` passará a incluir `pre_used_days`
- Novo campo no formulário ao lado de "Total de Afastamentos"

