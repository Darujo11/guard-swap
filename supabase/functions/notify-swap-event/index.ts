import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { swapMessages, type SwapMessageData } from "../_shared/messages.ts";

// Disparada pelo trigger trg_enqueue_swap_notification (pg_net) com { notification_id }.
// Substitui o fluxo do n8n (webhook /show): mesma ordem e mesmos intervalos; textos em ../_shared/messages.ts.
// Ver supabase/migrations/20261023120000_swap_notifications_outbox.sql e docs/sistema-avisos-trocas.md.

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const EVOLUTION_URL = "https://evolution.autozapx.com/message/sendText/escala";

type SwapEvent =
  | "troca_solicitada"
  | "troca_aceita"
  | "troca_aprovada_admin"
  | "troca_rejeitada_admin"
  | "troca_rejeitada_alvo"
  | "troca_cancelada";

interface Person {
  name: string;
  phone: string | null;
}

interface OutgoingMessage {
  label: string;
  phone: string | null;
  text: string;
  // Intervalo antes deste envio, como os nós Wait do n8n (evita rajada no WhatsApp).
  delayMs: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Aceita "22992618308", "(22) 99261-8308", "5522992618308" e "022992618308".
const toWhatsAppNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 12 && digits.startsWith("55") ? digits : `55${digits}`;
};

// Textos em ../_shared/messages.ts; aqui só se decide quem recebe o quê e em que ordem.
function buildMessages(
  event: SwapEvent,
  requester: Person,
  target: Person,
  coordinator: Person | null,
  data: SwapMessageData,
): OutgoingMessage[] {
  switch (event) {
    case "troca_solicitada":
      return [
        { label: "alvo", phone: target.phone, delayMs: 0, text: swapMessages.requestedToTarget(data) },
        { label: "solicitante", phone: requester.phone, delayMs: 15_000, text: swapMessages.requestedToRequester(data) },
      ];
    case "troca_aceita":
      return [
        { label: "coordenador", phone: coordinator?.phone ?? null, delayMs: 0, text: swapMessages.acceptedToCoordinator(data) },
        { label: "solicitante", phone: requester.phone, delayMs: 40_000, text: swapMessages.acceptedToRequester(data) },
      ];
    case "troca_aprovada_admin":
      return [
        { label: "solicitante", phone: requester.phone, delayMs: 0, text: swapMessages.approvedToRequester(data) },
        { label: "alvo", phone: target.phone, delayMs: 15_000, text: swapMessages.approvedToTarget(data) },
      ];
    case "troca_rejeitada_admin":
      return [
        { label: "solicitante", phone: requester.phone, delayMs: 0, text: swapMessages.rejectedByCoordinatorToRequester(data) },
        { label: "alvo", phone: target.phone, delayMs: 15_000, text: swapMessages.rejectedByCoordinatorToTarget(data) },
      ];
    case "troca_rejeitada_alvo":
      return [
        { label: "solicitante", phone: requester.phone, delayMs: 0, text: swapMessages.rejectedByTargetToRequester(data) },
      ];
    case "troca_cancelada":
      return [
        { label: "alvo", phone: target.phone, delayMs: 0, text: swapMessages.cancelledToTarget(data) },
      ];
  }
}

Deno.serve(async (req) => {
  console.log("notify-swap-event invoked:", req.method, new Date().toISOString());
  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  let notificationId: unknown;
  try {
    ({ notification_id: notificationId } = await req.json());
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (typeof notificationId !== "string" || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
    return json({ error: "notification_id inválido" }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Claim atômico: só um processamento por evento, e só eventos que o trigger criou.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("swap_notifications")
    .update({ status: "processing" })
    .eq("id", notificationId)
    .eq("status", "pending")
    .select("id, swap_id, event")
    .maybeSingle();

  if (claimError) {
    console.error("Error claiming notification:", claimError);
    return json({ error: claimError.message }, 500);
  }
  if (!claimed) {
    return json({ success: true, skipped: true, message: "Evento inexistente ou já processado" });
  }

  const finish = (status: "sent" | "failed", error: string | null) =>
    supabaseAdmin
      .from("swap_notifications")
      .update({ status, error, processed_at: new Date().toISOString() })
      .eq("id", claimed.id);

  const process = async () => {
    try {
      const token = Deno.env.get("tokenevolutiondainstancia");
      if (!token) {
        throw new Error("Token da instância Evolution não configurado");
      }

      const { data: swap, error: swapError } = await supabaseAdmin
        .from("swap_requests")
        .select(`
          id, admin_id, admin_approved_by, reason, requester_shift_date, target_shift_date,
          requester:profiles!swap_requests_requester_id_fkey(name, phone),
          target:profiles!swap_requests_target_id_fkey(name, phone)
        `)
        .eq("id", claimed.swap_id)
        .single();

      if (swapError || !swap) {
        throw new Error(`Troca ${claimed.swap_id} não encontrada: ${swapError?.message}`);
      }

      const requester = swap.requester as unknown as Person;
      const target = swap.target as unknown as Person;
      const event = claimed.event as SwapEvent;
      const isDecision = event === "troca_aprovada_admin" || event === "troca_rejeitada_admin";

      const [coordinatorRes, decidedByRes, signatureRes] = await Promise.all([
        swap.admin_id
          ? supabaseAdmin.from("profiles").select("name, phone").eq("id", swap.admin_id).maybeSingle()
          : Promise.resolve({ data: null }),
        isDecision && swap.admin_approved_by
          ? supabaseAdmin.from("profiles").select("name").eq("id", swap.admin_approved_by).maybeSingle()
          : Promise.resolve({ data: null }),
        // Código da assinatura eletrônica: só nas mensagens de aprovação.
        event === "troca_aprovada_admin"
          ? supabaseAdmin.from("swap_signatures").select("verification_code").eq("swap_id", swap.id).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const coordinator = (coordinatorRes.data as Person | null) ?? null;
      const data: SwapMessageData = {
        swapId: swap.id,
        requester: requester.name,
        target: target.name,
        requesterDate: swap.requester_shift_date,
        targetDate: swap.target_shift_date,
        reason: swap.reason,
        coordinator: coordinator?.name ?? null,
        decidedBy: (decidedByRes.data as { name: string } | null)?.name ?? null,
        verificationCode: (signatureRes.data as { verification_code: string } | null)?.verification_code ?? null,
      };

      const messages = buildMessages(event, requester, target, coordinator, data);

      const errors: string[] = [];
      for (const message of messages) {
        if (message.delayMs > 0) await sleep(message.delayMs);

        if (!message.phone) {
          console.error(`No phone for ${message.label} on swap ${swap.id}`);
          errors.push(`${message.label}: sem telefone`);
          continue;
        }

        const number = toWhatsAppNumber(message.phone);
        try {
          const whatsappResponse = await fetch(EVOLUTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: token },
            body: JSON.stringify({ number, text: message.text }),
          });

          if (!whatsappResponse.ok) {
            const errBody = await whatsappResponse.text();
            console.error("Evolution API error:", whatsappResponse.status, errBody);
            errors.push(`${message.label}: erro WhatsApp ${whatsappResponse.status}`);
          } else {
            console.log(`${claimed.event}: sent to ${message.label} (${number})`);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          console.error(`Error sending to ${message.label}:`, msg);
          errors.push(`${message.label}: ${msg}`);
        }
      }

      await finish(errors.length ? "failed" : "sent", errors.length ? errors.join("; ") : null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      console.error("notify-swap-event error:", msg);
      await finish("failed", msg);
    }
  };

  // Responde já (pg_net tem timeout curto) e envia em segundo plano com os intervalos.
  EdgeRuntime.waitUntil(process());
  return json({ success: true, accepted: claimed.id }, 202);
});
