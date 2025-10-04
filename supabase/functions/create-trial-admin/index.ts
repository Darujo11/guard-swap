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

    const { email, password, name, phone } = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: 'Email, senha e nome são obrigatórios' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log('[create-trial-admin] Creating trial admin:', { email, name });

    // 1. Check if user already exists
    const { data: existingUserId } = await supabaseAdmin.rpc('get_user_id_by_email', { 
      email_address: email 
    });

    if (existingUserId) {
      return new Response(
        JSON.stringify({ error: 'Este email já está cadastrado no sistema' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError) {
      console.error('[create-trial-admin] Auth error:', authError);
      throw authError;
    }

    const userId = authData.user.id;
    console.log('[create-trial-admin] User created:', userId);

    // 3. Create profile
    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ 
        user_id: userId, 
        email, 
        name, 
        phone: phone || null,
        is_active: true
      })
      .select('id')
      .single();

    if (profileError) {
      console.error('[create-trial-admin] Profile error:', profileError);
      throw profileError;
    }
    
    const profileId = newProfile.id;
    console.log('[create-trial-admin] Profile created:', profileId);
    
    // 4. Update profile with admin_id (admin manages their own data)
    await supabaseAdmin
      .from('profiles')
      .update({ admin_id: profileId })
      .eq('id', profileId);
    
    // 5. Assign admin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' });

    if (roleError) {
      console.error('[create-trial-admin] Role error:', roleError);
      throw roleError;
    }
    console.log('[create-trial-admin] Admin role assigned');

    // 6. Get or create trial plan
    let trialPlanId: string;
    const { data: existingPlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('name', 'Trial 7 dias')
      .eq('duration_months', 0)
      .maybeSingle();

    if (existingPlan) {
      trialPlanId = existingPlan.id;
    } else {
      const { data: newPlan, error: planError } = await supabaseAdmin
        .from('subscription_plans')
        .insert({
          name: 'Trial 7 dias',
          description: 'Período de teste gratuito de 7 dias',
          price: 0,
          duration_months: 0,
          max_guards: 50,
          max_teams: null,
          active: true,
          features: ['Até 50 profissionais', 'Equipes ilimitadas', 'Gestão completa', 'Suporte por email']
        })
        .select('id')
        .single();

      if (planError) {
        console.error('[create-trial-admin] Plan creation error:', planError);
        throw planError;
      }

      trialPlanId = newPlan.id;
    }

    // 7. Create trial subscription (7 days from now)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    const { error: subscriptionError } = await supabaseAdmin
      .from('admin_subscriptions')
      .insert({
        admin_id: profileId,
        plan_id: trialPlanId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        payment_status: 'trial'
      });

    if (subscriptionError) {
      console.error('[create-trial-admin] Subscription error:', subscriptionError);
      throw subscriptionError;
    }

    console.log('[create-trial-admin] Trial subscription created');

    // 8. Create organization settings
    await supabaseAdmin
      .from('organization_settings')
      .insert({
        admin_id: profileId
      });

    // 9. Log audit trail
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: 'CREATE_TRIAL_ADMIN',
        entity_type: 'admin',
        entity_id: profileId,
        details: { email, trial_days: 7 }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conta trial criada com sucesso!',
        userId,
        email,
        trialEndDate: endDate.toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[create-trial-admin] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao criar conta trial' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
