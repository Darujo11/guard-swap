

## Plano: Bloquear datas fora do mês no calendário de troca

### O que será feito

Quando `swap_same_month_only` estiver ativo, o calendário "Data do Plantão que Você Quer Assumir" só permitirá selecionar datas do mesmo mês/ano da data já escolhida em "Data do Seu Plantão". Datas de outros meses ficarão desabilitadas (cinza, não clicáveis).

### Alteração

#### `src/components/guards/GuardSwapForm.tsx`

- Linha 545-549: Na função `disabled` do calendário de target, adicionar verificação: se `settings.swap_same_month_only` e `requesterShiftDate` existir, desabilitar qualquer data cujo mês/ano seja diferente do `requesterShiftDate`
- Também limpar `targetShiftDate` quando `requesterShiftDate` mudar (linha 482-484), caso a data do target já selecionada fique fora do mês

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/components/guards/GuardSwapForm.tsx` | Filtro de mês no `disabled` do calendário target + reset ao mudar data do requester |

