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

    // Só super_admin: antes qualquer pessoa apagava qualquer usuário sabendo só o telefone
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: { user }, error: callerError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (callerError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: superAdminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!superAdminRole) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas super admins podem resetar usuários de teste.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { phone, admin_id } = await req.json();
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Telefone é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    const phoneClean = phone.replace(/\D/g, '');
    const loginEmail = `${phoneClean}@guardshift.com`;

    console.log('[reset-test-guard] Resetting guard with email:', loginEmail);

    // Find existing user by email
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('[reset-test-guard] Error listing users:', listError);
    }

    const existingUser = existingUsers?.users?.find(u => u.email === loginEmail);

    if (existingUser) {
      // O login de todo segurança é <telefone>@guardshift.com: sem esta trava, "resetar teste"
      // com o telefone de um segurança real apagaria a conta dele (e as trocas, em cascata).
      const [{ data: existingProfile }, { data: existingRoles }] = await Promise.all([
        supabaseAdmin.from('profiles').select('name').eq('user_id', existingUser.id).maybeSingle(),
        supabaseAdmin.from('user_roles').select('role').eq('user_id', existingUser.id),
      ]);

      const isTestAccount =
        existingProfile?.name === 'Usuário Teste' &&
        (existingRoles ?? []).every((r) => r.role === 'guard');

      if (!isTestAccount) {
        console.warn('[reset-test-guard] Refusing to delete non-test account:', existingUser.id);
        return new Response(
          JSON.stringify({ error: 'Este telefone pertence a uma conta que não é de teste. Nada foi apagado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        );
      }

      console.log('[reset-test-guard] Found existing user, deleting:', existingUser.id);
      
      // Delete from profiles first
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', existingUser.id);
      
      // Delete from user_roles
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', existingUser.id);
      
      // Delete auth user
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      
      console.log('[reset-test-guard] Existing user deleted');
    }

    // Now create the new user
    const name = "Usuário Teste";
    const defaultPassword = '123456';

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
      console.error('[reset-test-guard] Auth error:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Falha ao criar usuário');
    }

    console.log('[reset-test-guard] User created:', authData.user.id);

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
      console.error('[reset-test-guard] Profile error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Assign guard role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'guard',
      });

    if (roleError) {
      console.error('[reset-test-guard] Role error:', roleError);
      throw roleError;
    }

    console.log('[reset-test-guard] Guard created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        login_phone: phone,
        login_email: loginEmail,
        password: defaultPassword,
        message: `✅ Usuário de teste criado com sucesso!`,
        instructions: `
📱 Login: ${phone}
🔑 Senha: ${defaultPassword}
📧 Email: ${loginEmail}
        `.trim()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('[reset-test-guard] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
