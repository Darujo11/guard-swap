

## Plano: Corrigir rotação de escalas Jan-Mar 2026

### Diagnóstico

**Abril em diante (correto):** rotação diária A→B→C→D→A→B→C→D...
- Apr 1=C, Apr 2=D, Apr 3=A, Apr 4=B, Apr 5=C...

**Jan/Feb/Mar (quebrado):** dados sem padrão consistente (ex: Jan 1=A, Jan 2=B, Jan 3=A, Jan 4=D — pula equipes).

### Cálculo

Abril 1 = Equipe C (índice 2). Retrocedendo 90 dias até Jan 1:
- Jan 1 = índice (2 - 90) mod 4 = 0 = **Equipe A**
- Jan 2 = B, Jan 3 = C, Jan 4 = D, Jan 5 = A...

Isso garante continuidade perfeita com abril.

### Solução

**Migration SQL** que:
1. Deleta todos os registros de `team_schedules` entre 2026-01-01 e 2026-03-31
2. Insere novos registros com a rotação correta A→B→C→D para cada dia

IDs das equipes:
- Equipe A: `96f49762-c5cd-4569-bb89-9120974e1ad6`
- Equipe B: `d8029803-d2a5-49a4-873d-c53b9d814cf7`
- Equipe C: `0855ea10-2a80-455c-b30f-21b2ca10b494`
- Equipe D: `5f763a8d-2f0a-41ed-924d-2ffa266e9bca`

A migration usa `generate_series` para gerar os 90 dias e atribui a equipe com base em `(dia mod 4)`, mapeando 0→A, 1→B, 2→C, 3→D.

### Escopo
- Apenas 1 migration SQL (nenhuma alteração de código frontend)

