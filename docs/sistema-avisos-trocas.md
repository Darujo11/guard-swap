# Sistema de Avisos de Troca via WhatsApp (sem n8n)

Envia WhatsApp a cada etapa de uma troca de plantão. Substitui o fluxo n8n `escalasmart2.0` (webhook `/show`).
O lembrete diário das 08:00 é outro sistema: ver `docs/sistema-lembrete-trocas.md`.

---

## 1. Arquitetura

```text
UPDATE/INSERT swap_requests
        │  (trigger AFTER, mesmo para mudanças feitas por qualquer tela ou API)
        ▼
trg_enqueue_swap_notification ──▶ INSERT swap_notifications (status = pending)
        │                          + net.http_post({ notification_id })  ← só sai após o COMMIT
        ▼
Edge Function notify-swap-event
  1. claim atômico: pending → processing (senão ignora)
  2. responde 202 e segue em segundo plano (EdgeRuntime.waitUntil)
  3. busca troca + perfis (nomes, telefones, coordenador = swap_requests.admin_id)
  4. envia pela Evolution API (instância `escala`) com os intervalos do antigo n8n
  5. grava status sent | failed (+ error)
```

| Componente | Onde |
|---|---|
| Tabela `swap_notifications` + trigger | `supabase/migrations/20261023120000_swap_notifications_outbox.sql` |
| Edge Function `notify-swap-event` | `supabase/functions/notify-swap-event/index.ts` (`verify_jwt = false`) |
| Secret `tokenevolutiondainstancia` | Supabase → Edge Functions → Secrets (já existente) |
| `send-swap-webhook` | Desativada (no-op), mantida só para clientes PWA antigos |

---

## 2. Eventos e mensagens

| Mudança em `swap_requests` | Evento | Envios (em ordem) |
|---|---|---|
| INSERT `PENDING` | `troca_solicitada` | alvo → 15 s → solicitante |
| `PENDING → ACCEPTED` | `troca_aceita` | coordenador → 40 s → solicitante |
| `ACCEPTED → APPROVED` | `troca_aprovada_admin` | solicitante → 15 s → alvo |
| `→ REJECTED` por admin | `troca_rejeitada_admin` | solicitante → 15 s → alvo |
| `PENDING → REJECTED` pelo alvo | `troca_rejeitada_alvo` | solicitante |

Rejeição é "por admin" quando `OLD.status = 'ACCEPTED'`, ou `admin_approved_by` foi preenchido, ou quem fez o UPDATE tem papel `admin`/`super_admin`.

`CANCELLED` não gera aviso. Cada evento é enviado no máximo uma vez por troca (`unique (swap_id, event)`).

Os textos estão em `buildMessages()` na edge function. Diferenças em relação ao n8n:

- Recusa pelo alvo tinha o texto "o coordenador rejeitou"; agora tem mensagem própria, só para o solicitante.
- Aviso de "troca aceita" vai para o telefone do coordenador da troca (`admin_id`), não mais para um número fixo.
- Datas em `DD/MM/AAAA` (antes saíam `AAAA-MM-DD`).
- Telefone normalizado (aceita máscara, `0` ou `55` na frente).
- Pequenas correções de texto (nome do alvo na rejeição, concordância, pontuação).

---

## 3. Segurança

- O navegador não envia mais telefone nem texto: tudo vem do banco.
- `notify-swap-event` aceita só `{ notification_id }` e processa apenas eventos `pending` criados pelo trigger. Chamar de fora não escolhe destino nem reenvia.
- `swap_notifications` tem RLS ligada sem policies: só service role acessa.
- Falha na notificação nunca desfaz a troca (bloco `exception` no trigger).

---

## 4. Operação

```sql
-- Últimos avisos
select n.created_at, n.event, n.status, n.error, n.swap_id
  from swap_notifications n
 order by n.created_at desc
 limit 50;

-- Reenviar um aviso que falhou
update swap_notifications set status = 'pending', error = null where id = '<id>';
select net.http_post(
  url := 'https://wyoysecfbmmidjiofymg.supabase.co/functions/v1/notify-swap-event',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := jsonb_build_object('notification_id', '<id>')
);

-- Desligar os avisos (emergência) / religar
alter table swap_requests disable trigger trg_enqueue_swap_notification;
alter table swap_requests enable trigger trg_enqueue_swap_notification;
```

| Sintoma | O que checar |
|---|---|
| Nenhuma linha em `swap_notifications` | Migration aplicada? Trigger habilitado? |
| Linha presa em `pending` | Chamada `pg_net` falhou: `select * from net._http_response order by created desc limit 20;` |
| Linha presa em `processing` | Function caiu no meio: logs de `notify-swap-event` |
| `failed` com "sem telefone" | `profiles.phone` vazio (do segurança ou do coordenador) |
| `failed` com "erro WhatsApp 401/403" | Token da instância inválido ou instância desconectada |
