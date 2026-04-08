

## Plano: Criar o job pg_cron para disparar o lembrete diário

### O que falta
A migração anterior habilitou as extensões `pg_cron` e `pg_net`, mas o job que agenda a chamada diária à edge function `notify-swap-reminder` não foi criado.

### Solução
Executar via SQL (insert tool, não migração — contém dados específicos do projeto):

```sql
SELECT cron.schedule(
  'notify-swap-reminder-daily',
  '0 11 * * *',  -- 08:00 Brasília (UTC-3)
  $$
  SELECT net.http_post(
    url:='https://wyoysecfbmmidjiofymg.supabase.co/functions/v1/notify-swap-reminder',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b3lzZWNmYm1taWRqaW9meW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNzc2MjEsImV4cCI6MjA3Mzc1MzYyMX0.os1MBrbPse2DekdQzEe_mgIqFdqPkfWwcf9rQZsoVIg"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
```

### Também: Deploy da edge function
Fazer deploy da `notify-swap-reminder` para que esteja disponível quando o cron disparar.

### Resultado
- Todos os dias às 08:00 (Brasília), o sistema busca trocas aprovadas para o dia seguinte e envia lembretes via WhatsApp.

