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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { name, phone, admin_id } = await req.json();

    console.log('[create-test-guard] Creating test guard:', { name, phone, admin_id });

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Nome e telefone são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const phoneClean = phone.replace(/\D/g, '');
    const loginEmail = `${phoneClean}@guardshift.com`;
    const defaultPassword = '123456';

    console.log('[create-test-guard] Creating auth user with email:', loginEmail);

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        name: name,
        phone: phone,
      }
    });

    if (authError) {
      console.error('[create-test-guard] Auth error:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Falha ao criar usuário');
    }

    console.log('[create-test-guard] User created:', authData.user.id);

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        name: name,
        email: loginEmail,
        phone: phone,
        team_id: null,
        is_shift_chief: false,
        admin_id: admin_id,
      });

    if (profileError) {
      console.error('[create-test-guard] Profile error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    console.log('[create-test-guard] Profile created');

    // Assign guard role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'guard',
      });

    if (roleError) {
      console.error('[create-test-guard] Role error:', roleError);
      throw roleError;
    }

    console.log('[create-test-guard] Role assigned successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        login_email: loginEmail,
        login_phone: phone,
        password: defaultPassword,
        message: `Usuário de teste ${name} criado com sucesso!`,
        instructions: `Login: ${phone} | Senha: ${defaultPassword}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('[create-test-guard] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
