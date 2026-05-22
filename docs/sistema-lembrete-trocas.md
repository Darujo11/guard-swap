# Sistema de Lembrete de Trocas via WhatsApp

Documentação completa e passo a passo do sistema que envia, todos os dias às **08:00 (horário de Brasília)**, lembretes via WhatsApp para os seguranças que terão plantão **no dia seguinte** em decorrência de uma **troca aprovada**.

---

## 1. Visão Geral

- **Objetivo:** evitar que seguranças esqueçam de um plantão que assumiram via troca aprovada.
- **Quem recebe a mensagem:** o segurança que **vai cobrir** o plantão de amanhã (não o titular original).
- **Canal:** WhatsApp, via Evolution API (`https://evolution.autozapx.com`), instância `escala`.
- **Disparo:** automático, via `pg_cron` no Supabase, todo dia às **11:00 UTC** = **08:00 America/Sao_Paulo**.
- **Fonte de verdade:** tabela `swap_requests` com `status = 'APPROVED'`.

---

## 2. Arquitetura

```text
┌──────────────┐   08:00 BRT   ┌───────────────────────┐   HTTP POST   ┌─────────────────────────────┐
│   pg_cron    │ ────────────▶ │  net.http_post (pg)   │ ────────────▶ │  Edge Function              │
│ (job diário) │               │  Authorization: anon  │               │  notify-swap-reminder       │
└──────────────┘               └───────────────────────┘               └──────────────┬──────────────┘
                                                                                      │
                                                       ┌──────────────────────────────┼──────────────────────────────┐
                                                       ▼                              ▼                              ▼
                                              ┌────────────────┐           ┌────────────────────┐         ┌──────────────────────┐
                                              │ swap_requests  │           │     profiles       │         │  Evolution API       │
                                              │ status=APPROVED│           │ (name, phone)      │         │  /message/sendText   │
                                              └────────────────┘           └────────────────────┘         └──────────────────────┘
```

---

## 3. Componentes

| Componente | Tipo | Localização |
|---|---|---|
| `notify-swap-reminder` | Supabase Edge Function (Deno) | `supabase/functions/notify-swap-reminder/index.ts` |
| `notify-swap-reminder-daily` | Job `pg_cron` | Banco Supabase (schema `cron`) |
| `tokenevolutiondainstancia` | Secret | Supabase Edge Functions Secrets |
| `swap_requests` | Tabela | Schema `public` |
| `profiles` | Tabela | Schema `public` |
| Evolution API | Serviço externo | `https://evolution.autozapx.com/message/sendText/escala` |

`supabase/config.toml` declara:

```toml
[functions.notify-swap-reminder]
verify_jwt = false
```

---

## 4. Passo a Passo de Execução (o que acontece todo dia às 8h)

1. O `pg_cron` dispara o job `notify-swap-reminder-daily` (cron `0 11 * * *` UTC).
2. O comando do job executa `net.http_post(...)` apontando para a URL da edge function, com o header `Authorization: Bearer <ANON_KEY>`.
3. A edge function recebe a requisição (`POST`, sem corpo relevante).
4. Responde imediatamente o pré-flight `OPTIONS` com CORS abertos.
5. Instancia um cliente Supabase com **service role** (`SUPABASE_SERVICE_ROLE_KEY`) para bypassar RLS.
6. Calcula **"amanhã"** convertendo o instante atual para o fuso `America/Sao_Paulo` e somando 1 dia → string `YYYY-MM-DD`.
7. Calcula a **saudação dinâmica** com base na hora local: `Bom dia` (6–11), `Boa tarde` (12–17), `Boa noite` (resto).
8. Consulta `swap_requests` filtrando `status = 'APPROVED'` e onde `requester_shift_date = amanhã` **ou** `target_shift_date = amanhã`.
9. Se nenhum swap, retorna `{ success: true, sent: 0 }`.
10. Para cada swap encontrado, monta uma lista de "reminders" — quem deve ser lembrado e quem é o colega da troca:
    - Se o plantão original do **requester** é amanhã, quem cobre é o **target** → lembrar o target.
    - Se o plantão original do **target** é amanhã, quem cobre é o **requester** → lembrar o requester.
    - Um mesmo swap pode gerar dois lembretes (caso raríssimo de datas iguais).
11. Para cada `reminder`:
    - Busca em `profiles` o `name` e `phone` do segurança a notificar e o `name` do colega.
    - Se não tem telefone, pula com erro logado.
    - Formata datas para `DD/MM/YYYY`.
    - Pega os 8 primeiros caracteres do `swap.id` como protocolo curto.
    - Monta a mensagem personalizada.
    - Normaliza o telefone (remove caracteres não numéricos, garante prefixo `55`).
    - Faz `POST` na Evolution API com o token da instância no header `apikey`.
    - Conta sucessos e acumula erros.
12. Retorna JSON `{ success: true, sent: N, errors: [...] }`.

### Mensagem enviada (template)

```
{Saudação} {PrimeiroNome}! 🔔 Lembrete: Não se esqueça do seu plantão de amanhã
({DD/MM/YYYY}) em virtude da troca com {NomeDoColega}.
Troca: dia {DD/MM/YYYY} ↔ dia {DD/MM/YYYY}. Protocolo: {8charsDoSwapId}.
```

---

## 5. Código Completo Comentado — `supabase/functions/notify-swap-reminder/index.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS — permite chamadas vindas de qualquer origem (cron, dashboard, curl)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log("notify-swap-reminder invoked:", req.method, new Date().toISOString());

  // 1) Pré-flight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2) Cliente admin (bypassa RLS para ler swap_requests e profiles globalmente)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3) Cálculo de "amanhã" no fuso de Brasília
    //    toLocaleString força conversão para America/Sao_Paulo antes do +1 dia
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    // 4) Saudação dinâmica
    const hour = now.getHours();
    const saudacao =
      hour >= 6 && hour < 12 ? "Bom dia"
      : hour >= 12 && hour < 18 ? "Boa tarde"
      : "Boa noite";

    console.log("Looking for approved swaps for tomorrow:", tomorrowStr);

    // 5) Busca swaps APROVADOS cuja data de plantão (de qualquer lado) seja amanhã
    const { data: swaps, error: swapsError } = await supabaseAdmin
      .from("swap_requests")
      .select(
        "id, requester_id, target_id, requester_shift_date, target_shift_date, status"
      )
      .eq("status", "APPROVED")
      .or(
        `requester_shift_date.eq.${tomorrowStr},target_shift_date.eq.${tomorrowStr}`
      );

    if (swapsError) {
      console.error("Error fetching swaps:", swapsError);
      throw new Error(swapsError.message);
    }

    if (!swaps || swaps.length === 0) {
      console.log("No swaps found for tomorrow");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma troca para amanhã", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6) Token da instância Evolution (secret)
    const token = Deno.env.get("tokenevolutiondainstancia");
    if (!token) {
      throw new Error("Token da instância Evolution não configurado");
    }

    let sentCount = 0;
    const errors: string[] = [];

    // 7) Processa cada swap
    for (const swap of swaps) {
      const reminders: {
        guardId: string;
        otherGuardId: string;
        shiftDate: string;
        otherShiftDate: string;
      }[] = [];

      // Se a data original do requester é amanhã, o TARGET cobre → lembrar TARGET
      if (swap.requester_shift_date === tomorrowStr) {
        reminders.push({
          guardId: swap.target_id,
          otherGuardId: swap.requester_id,
          shiftDate: swap.requester_shift_date,
          otherShiftDate: swap.target_shift_date,
        });
      }

      // Se a data original do target é amanhã, o REQUESTER cobre → lembrar REQUESTER
      if (swap.target_shift_date === tomorrowStr) {
        reminders.push({
          guardId: swap.requester_id,
          otherGuardId: swap.target_id,
          shiftDate: swap.target_shift_date,
          otherShiftDate: swap.requester_shift_date,
        });
      }

      // 8) Envia cada lembrete
      for (const reminder of reminders) {
        try {
          // Busca os dois profiles em paralelo
          const [guardRes, otherRes] = await Promise.all([
            supabaseAdmin.from("profiles")
              .select("name, phone").eq("id", reminder.guardId).single(),
            supabaseAdmin.from("profiles")
              .select("name").eq("id", reminder.otherGuardId).single(),
          ]);

          if (guardRes.error || !guardRes.data?.phone) {
            console.error("Guard profile not found or no phone:", reminder.guardId, guardRes.error);
            errors.push(`Guard ${reminder.guardId}: sem telefone`);
            continue;
          }

          const guardFirstName = guardRes.data.name.split(" ")[0];
          const otherName = otherRes.data?.name || "colega";

          // Formata YYYY-MM-DD → DD/MM/YYYY (sem usar Date para evitar UTC shift)
          const formatDate = (d: string) => {
            const [y, m, day] = d.split("-");
            return `${day}/${m}/${y}`;
          };

          const protocolShort = swap.id.substring(0, 8);

          const message =
            `${saudacao} ${guardFirstName}! 🔔 Lembrete: Não se esqueça do seu plantão de amanhã ` +
            `(${formatDate(reminder.shiftDate)}) em virtude da troca com ${otherName}. ` +
            `Troca: dia ${formatDate(reminder.shiftDate)} ↔ dia ${formatDate(reminder.otherShiftDate)}. ` +
            `Protocolo: ${protocolShort}.`;

          // Normaliza telefone: só dígitos e prefixo 55 (Brasil)
          const digits = guardRes.data.phone.replace(/\D/g, "");
          const phoneWithCountry = digits.startsWith("55") ? digits : `55${digits}`;

          // 9) Dispara WhatsApp
          const whatsappResponse = await fetch(
            "https://evolution.autozapx.com/message/sendText/escala",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: token,
              },
              body: JSON.stringify({
                number: phoneWithCountry,
                text: message,
              }),
            }
          );

          if (!whatsappResponse.ok) {
            const errBody = await whatsappResponse.text();
            console.error("Evolution API error:", whatsappResponse.status, errBody);
            errors.push(`Guard ${guardFirstName}: erro WhatsApp`);
          } else {
            console.log(`Reminder sent to ${guardFirstName} (${phoneWithCountry})`);
            sentCount++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          console.error("Error sending reminder:", msg);
          errors.push(msg);
        }
      }
    }

    // 10) Resposta consolidada
    return new Response(
      JSON.stringify({ success: true, sent: sentCount, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("notify-swap-reminder error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 6. Configuração do `pg_cron`

SQL exato que está em produção (job `notify-swap-reminder-daily`, jobid `3`):

```sql
SELECT cron.schedule(
  'notify-swap-reminder-daily',
  '0 11 * * *',  -- 11:00 UTC = 08:00 America/Sao_Paulo
  $$
  SELECT net.http_post(
    url := 'https://wyoysecfbmmidjiofymg.supabase.co/functions/v1/notify-swap-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

> O `<ANON_KEY>` real é o token público do projeto. Como `verify_jwt = false` em `config.toml`, qualquer chamada autenticada com anon (ou até sem token) executa a função — por isso o uso de service-role acontece **dentro** da função.

### Conferir / pausar / remover

```sql
-- Listar
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'notify-swap-reminder-daily';

-- Ver execuções recentes
SELECT * FROM cron.job_run_details
 WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'notify-swap-reminder-daily')
 ORDER BY start_time DESC LIMIT 20;

-- Desativar / reativar
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'notify-swap-reminder-daily'), active := false);

-- Remover
SELECT cron.unschedule('notify-swap-reminder-daily');
```

---

## 7. Como Reproduzir do Zero

1. **Habilitar extensões** no banco Supabase:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```
2. **Criar o secret** `tokenevolutiondainstancia` (apikey da instância Evolution `escala`) em Supabase → Edge Functions → Secrets.
3. **Criar a edge function** `supabase/functions/notify-swap-reminder/index.ts` com o código da seção 5.
4. **Registrar em `supabase/config.toml`**:
   ```toml
   [functions.notify-swap-reminder]
   verify_jwt = false
   ```
5. **Agendar o cron** com o SQL da seção 6.

---

## 8. Teste Manual

### a) Chamar a edge function direto

```bash
curl -i -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY>" \
  https://wyoysecfbmmidjiofymg.supabase.co/functions/v1/notify-swap-reminder
```

### b) Forçar um swap "para amanhã" antes do teste

```sql
-- Apenas em ambiente de teste!
UPDATE swap_requests
   SET status = 'APPROVED',
       target_shift_date = (CURRENT_DATE + INTERVAL '1 day')::date
 WHERE id = '<algum-swap-id>';
```

### c) Disparar o job de cron na hora

```sql
SELECT net.http_post(
  url := 'https://wyoysecfbmmidjiofymg.supabase.co/functions/v1/notify-swap-reminder',
  headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
  body := '{}'::jsonb
);
```

---

## 9. Troubleshooting

| Sintoma | Causa provável | O que checar |
|---|---|---|
| `sent: 0` mesmo havendo troca para amanhã | Status diferente de `APPROVED`, ou data salva no formato errado | `SELECT status, requester_shift_date, target_shift_date FROM swap_requests WHERE id = ...` |
| Erro `Token da instância Evolution não configurado` | Secret faltando | Settings → Edge Functions → Secrets |
| `Guard X: sem telefone` | `profiles.phone` vazio | `UPDATE profiles SET phone = '...' WHERE id = ...` |
| `Evolution API error: 401/403` | apikey inválida ou instância desconectada | Painel Evolution AutoZapX |
| Mensagem chega 1 dia antes/depois | Cron rodando em UTC, mas data calculada em outro fuso | Confirme que o agendamento é `0 11 * * *` (UTC) e que o código usa `America/Sao_Paulo` |
| Job não dispara | `pg_cron` desabilitado ou job inativo | `SELECT * FROM cron.job WHERE jobname = 'notify-swap-reminder-daily';` |
| Falha silenciosa | Edge function travou | Logs da função no dashboard |

---

## 10. Links Úteis

- Logs da edge function: https://supabase.com/dashboard/project/wyoysecfbmmidjiofymg/functions/notify-swap-reminder/logs
- Edge Functions (lista): https://supabase.com/dashboard/project/wyoysecfbmmidjiofymg/functions
- Secrets das functions: https://supabase.com/dashboard/project/wyoysecfbmmidjiofymg/settings/functions
- SQL Editor (para o cron): https://supabase.com/dashboard/project/wyoysecfbmmidjiofymg/sql/new

<!-- Documento gerado automaticamente. Atualize sempre que mudar o código da edge function ou o agendamento do cron. -->