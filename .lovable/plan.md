

## Plano: Limpar registros TRE de teste e simplificar tabela

### Problema
Os registros TRE no sistema (7 registros) foram inseridos como teste. O usuário quer zerá-los para que apenas as "Já tiradas (retroativo)" sejam contabilizadas.

### Alterações

| Componente | Detalhe |
|------------|---------|
| **Banco de dados** | Deletar os 7 registros TRE de teste da tabela `leaves` (Carlos Almeida: 2, Dinarte: 3, Flavio Godim: 1, Verneque: 1) |
| **AdminLeaves.tsx** | Remover colunas "Retroativas" e "No Sistema" da tabela de saldos. Manter apenas: Segurança, Total TRE, Já Tiradas, Saldo. O "Já Tiradas" será o `pre_used_days` + dias no sistema |

### Tabela simplificada

```text
Segurança      | Total TRE | Já Tiradas | Saldo
Carlos Almeida |    21     |     8      |  13
```

### Registros a deletar

| Segurança | Datas |
|-----------|-------|
| Carlos Almeida | 2026-02-24, 2026-03-24 |
| Dinarte | 2026-01-03, 2026-01-07, 2026-01-11 |
| Flavio Godim | 2026-01-22 |
| Verneque | 2026-02-14 |

