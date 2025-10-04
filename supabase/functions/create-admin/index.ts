import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: 'email, password e name são obrigatórios' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log('[create-admin] Processing admin:', { email, name });

    // 1. Try to find existing user by email
    let userId: string | null = null;
    const { data: existingUserId } = await supabaseAdmin.rpc('get_user_id_by_email', { 
      email_address: email 
    });

    if (existingUserId) {
      userId = existingUserId as string;
      console.log('[create-admin] User already exists:', userId);
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (authError) {
        console.error('[create-admin] Auth error:', authError);
        throw authError;
      }

      userId = authData.user.id;
      console.log('[create-admin] User created:', userId);
    }

    // 2. Ensure profile exists (upsert)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: userId, email, name });

      if (profileError) {
        console.error('[create-admin] Profile insert error:', profileError);
        throw profileError;
      }
      console.log('[create-admin] Profile created');
    } else {
      console.log('[create-admin] Profile already exists');
    }

    // 3. Check existing roles and ensure admin role
    const { data: existingRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const hasAdminRole = existingRoles?.some(r => r.role === 'admin');

    if (!hasAdminRole) {
      // Remove other roles first
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Assign admin role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });

      if (roleError) {
        console.error('[create-admin] Role error:', roleError);
        throw roleError;
      }
      console.log('[create-admin] Admin role assigned');
    } else {
      console.log('[create-admin] Admin role already exists');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin criado com sucesso!',
        userId,
        email
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[create-admin] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro desconhecido' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
