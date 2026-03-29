

## Plano: Renomear título e adicionar botão de PDF completo de todos os seguranças

### Alterações

#### 1. `src/pages/AdminGuards.tsx`

**Renomear título**: Linha 747, trocar "Seguranças Cadastrados" por "Seguranças".

**Botão de PDF completo**: Adicionar um botão "Gerar PDF de Todos" no CardHeader, ao lado do título. Ao clicar:
- Buscar os dados de escala (team_schedules), trocas aprovadas, extras e folgas TRE aprovadas de todos os seguranças do mês atual
- Gerar um PDF landscape com jsPDF + autoTable contendo uma tabela por segurança (nome, equipe, dias de plantão, extras, folgas TRE)
- Cada segurança em uma nova página, usando a mesma lógica do `generateSchedulePDF` mas em loop

**Nova função**: `generateAllGuardsSchedulePDF` no `src/utils/pdfGenerator.ts` que recebe um array de dados de seguranças e gera um PDF consolidado com uma página por segurança.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminGuards.tsx` | Renomear título + botão "Gerar PDF" + lógica de busca de dados de todos os seguranças |
| `src/utils/pdfGenerator.ts` | Nova função `generateAllGuardsSchedulePDF` para PDF consolidado |

