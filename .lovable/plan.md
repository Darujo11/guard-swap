

## Plano: Enviar WhatsApp ao admin quando segurança solicitar folga TRE

### O que será feito

Após o segurança confirmar a solicitação de folga TRE, enviar uma mensagem WhatsApp para o administrador via Evolution API com saudação dinâmica e detalhes da solicitação.

### Alterações

#### 1. Nova Edge Function `supabase/functions/notify-tre-leave/index.ts`

- Recebe: `guard_name`, `admin_id`, `leave_date`, `remaining_days`
- Busca o telefone do admin na tabela `profiles` pelo `admin_id`
- Gera saudação dinâmica (Bom dia/Boa tarde/Boa noite) baseada no horário de Brasília
- Envia mensagem via Evolution API:
  - URL: `https://evolution.autozapx.com/message/sendText/escala`
  - Token: secret `tokenevolutiondainstancia`
  - Mensagem: `"Bom dia Morais, tudo bem!? O segurança João solicita folga do TRE no dia 15/04/2026. Restam ainda 3 folgas a retirar."`
- Segue o mesmo padrão CORS e estrutura do `forgot-password`

#### 2. `src/pages/GuardDashboard.tsx` — Chamar a edge function após insert

No `handleSubmitTreLeave`, após inserir com sucesso na tabela `leaves`, chamar `supabase.functions.invoke('notify-tre-leave', ...)` passando:
- `guard_name`: `currentUser.name`
- `admin_id`: `currentUser.admin_id`
- `leave_date`: `treSelectedDate` formatado dd/MM/yyyy
- `remaining_days`: `treQuota - treUsed - 1` (já descontando a folga recém-solicitada)

A notificação é fire-and-forget — se falhar, não impede a solicitação.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/notify-tre-leave/index.ts` | Nova edge function para enviar WhatsApp |
| `src/pages/GuardDashboard.tsx` | Chamar edge function após insert da folga TRE |

