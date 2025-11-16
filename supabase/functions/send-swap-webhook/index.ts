import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://webhook.autozapx.com/webhook/getdados";

interface SwapWebhookData {
  evento: string;
  aprovacao_chefe_estado: "pendente" | "aprovado" | "rejeitado";
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_telefone?: string;
  alvo_nome: string;
  alvo_email: string;
  alvo_telefone?: string;
  data_plantao_solicitante: string;
  data_plantao_alvo: string;
  motivo: string;
  motivo_rejeicao?: string;
  status: string;
  data_criacao: string;
  data_resposta?: string;
  admin_aprovado: boolean;
  admin_aprovado_por?: string;
  admin_aprovado_em?: string;
}

// Retry logic com timeout e backoff exponencial
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
      
      console.log(`[SendSwapWebhook] Tentativa ${attempt + 1}/${maxRetries} para ${url}`);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[SendSwapWebhook] Erro HTTP ${response.status}:`, errorBody);
        
        // Se for último retry, lançar erro
        if (attempt === maxRetries - 1) {
          throw new Error(`Webhook retornou status ${response.status}: ${errorBody}`);
        }
        
        // Aguardar antes do próximo retry (1s, 2s, 4s)
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[SendSwapWebhook] Aguardando ${waitTime}ms antes do próximo retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      console.error(`[SendSwapWebhook] Erro na tentativa ${attempt + 1}:`, error);
      
      // Se for timeout ou último retry, lançar erro
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Aguardar antes do próximo retry (1s, 2s, 4s)
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`[SendSwapWebhook] Aguardando ${waitTime}ms antes do próximo retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error("Max retries exceeded");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[SendSwapWebhook] Payload recebido:", JSON.stringify(payload, null, 2));

    const webhookData: SwapWebhookData = {
      evento: payload.evento || "troca_solicitada",
      aprovacao_chefe_estado: payload.aprovacao_chefe_estado || "pendente",
      solicitante_nome: payload.requester_name,
      solicitante_email: payload.requester_email,
      solicitante_telefone: payload.requester_phone,
      alvo_nome: payload.target_name,
      alvo_email: payload.target_email,
      alvo_telefone: payload.target_phone,
      data_plantao_solicitante: payload.requester_shift_date,
      data_plantao_alvo: payload.target_shift_date,
      motivo: payload.reason,
      motivo_rejeicao: payload.rejection_reason,
      status: payload.status,
      data_criacao: payload.created_at,
      data_resposta: payload.responded_at,
      admin_aprovado: payload.admin_approved,
      admin_aprovado_por: payload.admin_approved_by,
      admin_aprovado_em: payload.admin_approved_at,
    };

    console.log("[SendSwapWebhook] Enviando para webhook:", WEBHOOK_URL);
    console.log("[SendSwapWebhook] Dados formatados:", JSON.stringify(webhookData, null, 2));

    const webhookResponse = await fetchWithRetry(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookData),
    });

    const responseText = await webhookResponse.text();
    console.log("[SendSwapWebhook] Resposta do webhook (status " + webhookResponse.status + "):", responseText);

    return new Response(JSON.stringify({ success: true, message: "Webhook enviado com sucesso" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[SendSwapWebhook] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
