import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// v2 - forced redeploy 2026-03-29
Deno.serve(async (req) => {
  console.log("notify-tre-leave-guard v2 invoked:", req.method, new Date().toISOString());
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guard_name, guard_phone, leave_date, admin_name, approved } = await req.json();

    if (!guard_name || !guard_phone || !leave_date || !admin_name) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: guard_name, guard_phone, leave_date, admin_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone
    const digits = guard_phone.replace(/\D/g, "");
    const phoneWithCountry = digits.startsWith("55") ? digits : `55${digits}`;

    // Dynamic greeting based on Brasília time
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = now.getHours();
    const saudacao = hour >= 6 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";

    const guardFirstName = guard_name.split(" ")[0];
    const adminFirstName = admin_name.split(" ")[0];

    const message = approved
      ? `${saudacao} ${guardFirstName}, sua folga TRE do dia ${leave_date} foi *autorizada* pelo coordenador ${adminFirstName}. ✅`
      : `${saudacao} ${guardFirstName}, sua folga TRE do dia ${leave_date} foi *rejeitada* pelo coordenador ${adminFirstName}. ❌`;

    const token = Deno.env.get("tokenevolutiondainstancia");
    if (!token) {
      throw new Error("Token da instância Evolution não configurado");
    }

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
      return new Response(
        JSON.stringify({ success: true, warning: "Decisão registrada, mas erro ao enviar WhatsApp." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notificação enviada por WhatsApp!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("notify-tre-leave-guard error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
