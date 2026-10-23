import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Só super_admin: esta function roda com verify_jwt = false e antes não checava quem chamava
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: { user: caller }, error: callerError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: callerSuperAdmin } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!callerSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas super admins podem alterar administradores.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { admin_id, name, email, is_active } = await req.json();

    if (!admin_id) {
      return new Response(
        JSON.stringify({ error: 'admin_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Atualizando administrador:', admin_id);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email')
      .eq('id', admin_id)
      .single();

    if (profileError || !profile) {
      console.error('Erro ao buscar perfil:', profileError);
      return new Response(
        JSON.stringify({ error: 'Administrador não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profileUpdates: any = {};
    if (name !== undefined) profileUpdates.name = name;
    if (is_active !== undefined) profileUpdates.is_active = is_active;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', admin_id);

      if (updateProfileError) {
        console.error('Erro ao atualizar perfil:', updateProfileError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar perfil' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (email && email !== profile.email) {
      const { error: updateEmailError } = await supabase.auth.admin.updateUserById(
        profile.user_id,
        { email: email }
      );

      if (updateEmailError) {
        console.error('Erro ao atualizar email:', updateEmailError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar email' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('profiles')
        .update({ email: email })
        .eq('id', admin_id);
    }

    console.log('Administrador atualizado com sucesso');

    return new Response(
      JSON.stringify({ success: true, message: 'Administrador atualizado com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});