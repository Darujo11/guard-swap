import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    // Get the user from the JWT to ensure the requester owns the account
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.getUser(jwt);
    if (getUserError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { user_id, phone } = await req.json();

    if (!user_id || !phone) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros inválidos.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (user_id !== userData.user.id) {
      return new Response(
        JSON.stringify({ error: 'Operação não permitida.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const phoneClean = String(phone).replace(/\D/g, '');
    if (!/^\d{10,13}$/.test(phoneClean)) {
      return new Response(
        JSON.stringify({ error: 'Telefone inválido. Use apenas números (10 a 13 dígitos).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const newEmail = `${phoneClean}@guardshift.com`;

    // Update auth email without confirmation using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email: newEmail,
      email_confirm: true,
    });

    if (updateError) {
      console.error('[update-auth-email] Admin update error:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message || 'Falha ao atualizar email de login.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, email: newEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[update-auth-email] Error:', e);
    return new Response(
      JSON.stringify({ error: e?.message || 'Erro inesperado.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});