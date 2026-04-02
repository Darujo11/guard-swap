

## Plano: Corrigir escala de abril/2026

### Diagnóstico

A rotação 24/72 segue o padrão A→B→C→D. Março termina corretamente (28:C, 29:D, 30:A, 31:B), então abril deveria começar com C. Porém 4 dias estão errados:

```text
Dia  | Atual     | Correto
-----|-----------|--------
 01  | Equipe A  | Equipe C
 03  | Equipe C  | Equipe A
 04  | Equipe A  | Equipe B
 27  | Equipe B  | Equipe A
```

Os demais dias (2, 5-26, 28-30) estão corretos.

### Solução

Executar 4 UPDATEs na tabela `team_schedules` para corrigir o `team_id` dos dias errados:

| ID do registro | Data | De → Para |
|---|---|---|
| `78a16319-...` | 01/04 | Equipe A → Equipe C |
| `f66a0ab5-...` | 03/04 | Equipe C → Equipe A |
| `ca68f06b-...` | 04/04 | Equipe A → Equipe B |
| `0442fe9c-...` | 27/04 | Equipe B → Equipe A |

Isso será feito via ferramenta de INSERT/UPDATE do Supabase (operação de dados, não migração de schema).

