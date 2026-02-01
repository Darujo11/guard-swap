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

    const { admin_id } = await req.json();

    if (!admin_id) {
      return new Response(
        JSON.stringify({ error: 'admin_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deletando administrador:', admin_id);

    // Buscar o perfil do admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', admin_id)
      .single();

    if (profileError || !profile) {
      console.error('Erro ao buscar perfil:', profileError);
      return new Response(
        JSON.stringify({ error: 'Administrador não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = profile.user_id;

    // 1. Deletar assinaturas do admin
    const { error: subsError } = await supabase
      .from('admin_subscriptions')
      .delete()
      .eq('admin_id', admin_id);

    if (subsError) {
      console.error('Erro ao deletar assinaturas:', subsError);
    }

    // 2. Deletar organization_settings do admin
    const { error: settingsError } = await supabase
      .from('organization_settings')
      .delete()
      .eq('admin_id', admin_id);

    if (settingsError) {
      console.error('Erro ao deletar settings:', settingsError);
    }

    // 3. Deletar todos os guards, teams, schedules, swaps, extras ligados a este admin
    // Deletar extras dos guards deste admin
    const { error: extrasError } = await supabase
      .from('extras')
      .delete()
      .eq('admin_id', admin_id);

    if (extrasError) {
      console.error('Erro ao deletar extras:', extrasError);
    }

    // Deletar swap_requests deste admin
    const { error: swapsError } = await supabase
      .from('swap_requests')
      .delete()
      .eq('admin_id', admin_id);

    if (swapsError) {
      console.error('Erro ao deletar swaps:', swapsError);
    }

    // Deletar team_schedules deste admin
    const { error: schedulesError } = await supabase
      .from('team_schedules')
      .delete()
      .eq('admin_id', admin_id);

    if (schedulesError) {
      console.error('Erro ao deletar schedules:', schedulesError);
    }

    // Deletar teams deste admin
    const { error: teamsError } = await supabase
      .from('teams')
      .delete()
      .eq('admin_id', admin_id);

    if (teamsError) {
      console.error('Erro ao deletar teams:', teamsError);
    }

    // 4. Buscar todos os profiles (guards) que pertencem a este admin
    const { data: guards, error: guardsError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('admin_id', admin_id)
      .not('user_id', 'is', null);

    if (!guardsError && guards) {
      // Deletar user_roles de cada guard
      for (const guard of guards) {
        if (guard.user_id) {
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', guard.user_id);

          // Deletar o guard do auth
          await supabase.auth.admin.deleteUser(guard.user_id);
        }
      }

      // Deletar profiles dos guards
      await supabase
        .from('profiles')
        .delete()
        .eq('admin_id', admin_id);
    }

    // 5. Deletar user_roles do admin
    if (userId) {
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Erro ao deletar roles:', rolesError);
      }
    }

    // 6. Deletar profile do admin
    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', admin_id);

    if (deleteProfileError) {
      console.error('Erro ao deletar profile:', deleteProfileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar perfil do administrador' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Por fim, deletar o usuário do auth
    if (userId) {
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteUserError) {
        console.error('Erro ao deletar usuário do auth:', deleteUserError);
        return new Response(
          JSON.stringify({ error: 'Erro ao deletar usuário do sistema de autenticação' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Administrador e todos os dados relacionados deletados com sucesso');

    return new Response(
      JSON.stringify({ success: true, message: 'Administrador deletado com sucesso' }),
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