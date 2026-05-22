## Documentação completa do sistema de lembretes de troca

Vou criar o arquivo `docs/sistema-lembrete-trocas.md` com documentação detalhada e passo a passo.

### Conteúdo do .md

1. **Visão geral** — propósito (lembrar via WhatsApp seguranças que cobrirão plantão amanhã devido a troca aprovada)
2. **Arquitetura** — diagrama do fluxo: pg_cron → net.http_post → edge function → Supabase (swap_requests + profiles) → Evolution API (WhatsApp)
3. **Componentes envolvidos**:
   - Edge Function `notify-swap-reminder`
   - Cron job `notify-swap-reminder-daily` (agendado para `0 11 * * *` UTC = 08:00 Brasília)
   - Secret `tokenevolutiondainstancia`
   - Tabelas `swap_requests`, `profiles`
   - Endpoint Evolution `https://evolution.autozapx.com/message/sendText/escala`
4. **Passo a passo de execução** (linha a linha do que acontece todo dia às 8h)
5. **Código completo comentado** do `supabase/functions/notify-swap-reminder/index.ts` (com explicações de cada bloco: CORS, cálculo de "amanhã" em America/Sao_Paulo, saudação dinâmica, busca de swaps APPROVED, lógica de quem lembrar, envio WhatsApp, tratamento de erros)
6. **SQL do cron job** (como foi criado, incluindo `cron.schedule(...)` real recuperado do banco)
7. **Como reproduzir do zero** (5 etapas: habilitar pg_cron/pg_net, criar secret, criar edge function, configurar `config.toml`, agendar cron)
8. **Como testar manualmente** (curl direto na função, query SQL para forçar swap APPROVED com `target_shift_date = amanhã`)
9. **Troubleshooting** (sem telefone no profile, token Evolution inválido, fuso horário, swap não-APPROVED)
10. **Links úteis** (logs da edge function, SQL editor, secrets)

### Local do arquivo
- `docs/sistema-lembrete-trocas.md` (criando pasta `docs/` se não existir)

### Não vou
- Modificar a edge function existente
- Mexer no cron job
- Alterar código de produção

Após sua aprovação, crio o arquivo direto.
