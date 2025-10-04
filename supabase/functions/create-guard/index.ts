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

    const { name, email, phone, team_id, is_shift_chief, admin_id } = await req.json();

    console.log('[create-guard] Creating guard:', { name, phone, admin_id });

    // Validate required fields
    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Nome e telefone são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Clean phone number (remove all non-digits)
    const phoneClean = phone.replace(/\D/g, '');
    
    // Create login email using phone
    const loginEmail = `${phoneClean}@guardshift.com`;
    
    // Generate secure random password (12 characters: alphanumeric + special chars)
    const generateSecurePassword = () => {
      const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      const array = new Uint8Array(12);
      crypto.getRandomValues(array);
      return Array.from(array, (byte) => charset[byte % charset.length]).join('');
    };
    
    const securePassword = generateSecurePassword();

    console.log('[create-guard] Creating auth user with email:', loginEmail);

    // Create user in auth.users using service role (bypasses email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password: securePassword,
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
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        name: name,
        email: email || loginEmail,
        phone: phone,
        team_id: team_id || null,
        is_shift_chief: is_shift_chief || false,
        admin_id: admin_id || null,
      });

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
      throw roleError;
    }

    console.log('[create-guard] Role assigned');

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: authData.user.id,
      action: 'GUARD_CREATED',
      entity_type: 'profile',
      entity_id: authData.user.id,
      details: {
        name: name,
        phone: phone,
        created_by: 'admin'
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        login: phone,
        password: securePassword,
        message: `Segurança ${name} criado com sucesso! Senha segura gerada automaticamente.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[create-guard] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});