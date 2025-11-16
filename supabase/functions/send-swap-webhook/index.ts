import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = "https://n8n.autozapx.com/webhook-test/55554956-a014-404b-879a-9ee22706bd8b";

interface SwapWebhookData {
  evento: string;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_telefone?: string;
  alvo_nome: string;
  alvo_email: string;
  alvo_telefone?: string;
  data_plantao_solicitante: string;
  data_plantao_alvo: string;
  motivo: string;
  status: string;
  data_criacao: string;
  data_resposta?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('[SendSwapWebhook] Payload recebido:', JSON.stringify(payload));

    const webhookData: SwapWebhookData = {
      evento: payload.evento || 'troca_solicitada',
      solicitante_nome: payload.requester_name,
      solicitante_email: payload.requester_email,
      solicitante_telefone: payload.requester_phone,
      alvo_nome: payload.target_name,
      alvo_email: payload.target_email,
      alvo_telefone: payload.target_phone,
      data_plantao_solicitante: payload.requester_shift_date,
      data_plantao_alvo: payload.target_shift_date,
      motivo: payload.reason,
      status: payload.status,
      data_criacao: payload.created_at,
      data_resposta: payload.responded_at,
    };

    console.log('[SendSwapWebhook] Enviando para webhook:', JSON.stringify(webhookData));

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook retornou status ${webhookResponse.status}`);
    }

    const responseText = await webhookResponse.text();
    console.log('[SendSwapWebhook] Resposta do webhook:', responseText);

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook enviado com sucesso' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[SendSwapWebhook] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
