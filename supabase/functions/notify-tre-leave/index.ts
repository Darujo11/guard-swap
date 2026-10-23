import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { treRequestToCoordinator } from "../_shared/messages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  console.log("notify-tre-leave invoked:", req.method, new Date().toISOString());
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guard_name, admin_id, leave_date, remaining_days } = await req.json();

    if (!guard_name || !admin_id || !leave_date) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: guard_name, admin_id, leave_date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch admin profile to get phone and name
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("name, phone")
      .eq("id", admin_id)
      .single();

    if (profileError || !adminProfile?.phone) {
      console.error("Admin profile not found or no phone:", profileError);
      return new Response(
        JSON.stringify({ error: "Telefone do administrador não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone
    const digits = adminProfile.phone.replace(/\D/g, "");
    const phoneWithCountry = digits.startsWith("55") ? digits : `55${digits}`;

    const message = treRequestToCoordinator({
      coordinator: adminProfile.name,
      guard: guard_name,
      leaveDate: leave_date,
      remainingDays: remaining_days,
    });

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
        JSON.stringify({ success: true, warning: "Folga registrada, mas erro ao enviar WhatsApp." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notificação enviada por WhatsApp!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("notify-tre-leave error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
