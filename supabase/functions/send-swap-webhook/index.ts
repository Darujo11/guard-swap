import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// DESATIVADA: os avisos de troca agora saem do banco (trigger trg_enqueue_swap_notification ->
// edge function notify-swap-event), sem n8n. Esta function continua publicada só para que
// versões antigas do app em cache (PWA) não recebam erro; ela não repassa mais nada pro n8n,
// senão os seguranças receberiam cada aviso em dobro. Pode ser removida quando não houver
// mais chamadas nos logs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[SendSwapWebhook] Chamada ignorada (desativada; avisos saem de notify-swap-event)");

  return new Response(
    JSON.stringify({ success: true, message: "Avisos de troca agora são enviados pelo banco" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
