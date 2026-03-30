

## Plano: Campo "Total de Folgas" iniciar vazio

### Alterações

#### `src/pages/AdminLeaves.tsx`

- Linha 85: Mudar `useState<number>(0)` para `useState<string>('')`
- Linha 727: Mudar `setTreDays(existing?.total_days || 0)` para `setTreDays(existing ? String(existing.total_days) : '')`
- Linha 198: Mudar `setTreDays(0)` para `setTreDays('')`
- Linha 746-747: Mudar `value={treDays}` e `onChange` para trabalhar com string, convertendo para número apenas no salvamento
- Linhas 186/193: Usar `parseInt(treDays) || 0` ao salvar no banco

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminLeaves.tsx` | Tipo do estado `treDays` de number para string, campo inicia vazio |

