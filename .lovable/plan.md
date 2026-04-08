

## Plano: Sistema de Lembrete de Troca via WhatsApp (1 dia antes)

### Visão geral
Criar uma edge function que roda diariamente (via pg_cron) e envia lembretes WhatsApp para seguranças que têm trocas aprovadas no dia seguinte. A mensagem inclui o nome do colega, as datas da troca e o protocolo (ID da troca).

### Componentes

**1. Edge Function `notify-swap-reminder/index.ts`**
- Busca todas as `swap_requests` com `status = 'APPROVED'` onde `requester_shift_date` ou `target_shift_date` é igual a amanhã
- Para cada troca encontrada, envia WhatsApp para o segurança que vai cobrir aquele plantão
- Usa a API Evolution (mesmo padrão das funções existentes como `notify-tre-leave`)
- Mensagem exemplo:
```text
Bom dia João! 🔔 Lembrete: Não se esqueça do seu plantão de amanhã (15/04/2026) em virtude da troca com Maria Santos. Troca: seu dia 12/04 ↔ dia 15/04. Protocolo: abc12345.
```

**2. Configuração pg_cron + pg_net**
- Habilitar as extensões `pg_cron` e `pg_net` via migração
- Criar um job que roda todos os dias às 08:00 (horário de Brasília = 11:00 UTC) chamando a edge function

**3. Configuração em `supabase/config.toml`**
- Adicionar `[functions.notify-swap-reminder]` com `verify_jwt = false` (chamado pelo cron)

### Lógica da edge function

```text
1. Calcular data de amanhã (fuso Brasília)
2. SELECT swap_requests WHERE status='APPROVED'
   AND (requester_shift_date = amanhã OR target_shift_date = amanhã)
3. Para cada troca:
   - Se requester_shift_date = amanhã → enviar para requester (com nome do target)
   - Se target_shift_date = amanhã → enviar para target (com nome do requester)
4. Buscar telefone do guard em profiles
5. Enviar via Evolution API (sendText)
6. Logar resultado
```

### Arquivos alterados/criados
- `supabase/functions/notify-swap-reminder/index.ts` — nova edge function
- `supabase/config.toml` — adicionar config da nova função
- Migração SQL — habilitar pg_cron/pg_net e criar o job diário

### Secret existente
O token da Evolution API já está configurado como `tokenevolutiondainstancia` nos secrets do Supabase.

