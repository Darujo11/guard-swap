import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Número de WhatsApp é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone: keep only digits
    const digits = phone.replace(/\D/g, "");
    const phoneWithCountry = digits.startsWith("55") ? digits : `55${digits}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Search profile by phone (try multiple formats)
    const phonesToTry = [digits, phoneWithCountry, `+${phoneWithCountry}`];
    let profile: any = null;

    for (const p of phonesToTry) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id, user_id, name, phone")
        .eq("phone", p)
        .limit(1)
        .maybeSingle();
      if (data) {
        profile = data;
        break;
      }
    }

    if (!profile || !profile.user_id) {
      return new Response(
        JSON.stringify({ error: "Número não encontrado no sistema" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate random 6-digit password
    const newPassword = String(Math.floor(100000 + Math.random() * 900000));

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword }
    );

    if (updateError) {
      throw new Error(`Erro ao resetar senha: ${updateError.message}`);
    }

    // Send WhatsApp message via Evolution API
    const tokeninstancia = Deno.env.get("tokeninstancia");
    if (!tokeninstancia) {
      throw new Error("Token da instância não configurado");
    }

    const whatsappResponse = await fetch(
      "https://evolution.autozapx.com/message/sendText/escala",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: tokeninstancia,
        },
        body: JSON.stringify({
          number: phoneWithCountry,
          text: `🔐 *Escala Smart - Recuperação de Senha*\n\nOlá, ${profile.name}!\n\nSua nova senha é: *${newPassword}*\n\nUse essa senha para fazer login no sistema. Recomendamos que você a memorize.\n\n_Mensagem automática, não responda._`,
        }),
      }
    );

    if (!whatsappResponse.ok) {
      const errBody = await whatsappResponse.text();
      console.error("Evolution API error:", whatsappResponse.status, errBody);
      return new Response(
        JSON.stringify({
          success: true,
          warning: `Senha resetada, mas erro ao enviar WhatsApp (status ${whatsappResponse.status}). Entre em contato com o administrador.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Nova senha enviada por WhatsApp!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("forgot-password error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
