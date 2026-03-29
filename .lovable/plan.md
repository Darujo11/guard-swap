

## Plano: Confirmação com digitação "TRE" para cancelar folga

### O que será feito

Ao clicar em "Cancelar", abrir um dialog pedindo que o segurança digite "TRE" para confirmar. Após a exclusão, exibir um toast com a mensagem "Informe ao Coordenador que cancelou a troca."

### Alterações

#### `src/pages/GuardDashboard.tsx`

- Adicionar estados: `cancelDialogOpen`, `cancelLeaveId`, `cancelConfirmText`
- Substituir o `onClick` direto do botão "Cancelar" por abertura do dialog
- Adicionar um `AlertDialog` com:
  - Título: "Confirmar cancelamento"
  - Input de texto onde o usuário deve digitar "TRE"
  - Botão "Confirmar" habilitado apenas quando o texto for exatamente "TRE"
- No `handleCancelTreLeave`: após exclusão bem-sucedida, exibir toast com mensagem "Informe ao Coordenador que cancelou a troca."
- Fechar dialog e limpar estados após confirmar

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GuardDashboard.tsx` | Dialog de confirmação com input "TRE" + toast informativo |

