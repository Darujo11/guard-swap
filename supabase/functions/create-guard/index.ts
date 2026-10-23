import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Quem chama precisa ser admin ativo (cria só na própria organização) ou super_admin.
    // verify_jwt = true não basta: a anon key pública também é um JWT válido.
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const [{ data: callerRoles }, { data: callerProfile }] = await Promise.all([
      supabaseAdmin.from('user_roles').select('role').eq('user_id', caller.id),
      supabaseAdmin.from('profiles').select('id, is_active').eq('user_id', caller.id).maybeSingle(),
    ]);
    const isSuperAdmin = (callerRoles ?? []).some((r) => r.role === 'super_admin');
    const isAdmin = (callerRoles ?? []).some((r) => r.role === 'admin');

    const { name, email, phone, team_id, is_shift_chief, admin_id: requestedAdminId } = await req.json();

    let admin_id: string | null;
    if (isSuperAdmin) {
      admin_id = requestedAdminId || null;
    } else if (isAdmin && callerProfile?.is_active) {
      if (requestedAdminId && requestedAdminId !== callerProfile.id) {
        return new Response(
          JSON.stringify({ error: 'Você só pode cadastrar seguranças na sua própria organização.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
      admin_id = callerProfile.id;
    } else {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores ativos podem cadastrar seguranças.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('[create-guard] Creating guard:', { name, phone, admin_id });

    // Validate required fields
    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Nome e telefone são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // A equipe tem que ser da mesma organização (senão o segurança entra na escala de outra)
    if (team_id) {
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('id', team_id)
        .eq('admin_id', admin_id)
        .maybeSingle();

      if (!team) {
        return new Response(
          JSON.stringify({ error: 'Equipe não encontrada nesta organização.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Clean phone number (remove all non-digits)
    const phoneClean = phone.replace(/\D/g, '');
    
    // Create login email using phone
    const loginEmail = `${phoneClean}@guardshift.com`;
    const defaultPassword = '123456';

    console.log('[create-guard] Creating auth user with email:', loginEmail);

    // Create user in auth.users using service role (bypasses email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password: defaultPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: name,
        phone: phone,
      }
    });

    if (authError) {
      console.error('[create-guard] Auth error:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Falha ao criar usuário');
    }

    console.log('[create-guard] User created:', authData.user.id);

    // Create profile
    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        name: name,
        email: email || loginEmail,
        phone: phone,
        team_id: team_id || null,
        is_shift_chief: is_shift_chief || false,
        admin_id: admin_id,
      })
      .select('id')
      .single();

    if (profileError) {
      console.error('[create-guard] Profile error:', profileError);
      // If profile creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    console.log('[create-guard] Profile created');

    // Assign guard role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'guard',
      });

    if (roleError) {
      console.error('[create-guard] Role error:', roleError);
      // Sem papel a conta não entra no sistema: desfaz para não deixar login/perfil pela metade
      await supabaseAdmin.from('profiles').delete().eq('id', newProfile.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw roleError;
    }

    console.log('[create-guard] Role assigned');

    // Create audit log (audit_logs.user_id é FK para profiles.id: autor = perfil de quem cadastrou)
    const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
      user_id: callerProfile?.id ?? newProfile.id,
      action: 'GUARD_CREATED',
      entity_type: 'profile',
      entity_id: newProfile.id,
      details: {
        name: name,
        phone: phone,
        created_by: isSuperAdmin ? 'super_admin' : 'admin',
        created_by_user_id: caller.id,
      }
    });
    if (auditError) {
      console.error('[create-guard] Audit log error:', auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        login: phone,
        password: defaultPassword,
        message: `Segurança ${name} criado com sucesso!`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('[create-guard] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});