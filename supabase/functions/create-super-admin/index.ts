import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { email, password, name } = await req.json()

    console.log('[create-super-admin] Creating super admin:', { email, name })

    // 1. Try to find existing user by email first (idempotent)
    let userId: string | null = null
    const { data: existingUserId, error: getUserIdErr } = await supabaseAdmin
      .rpc('get_user_id_by_email', { email_address: email })

    if (getUserIdErr) {
      console.warn('[create-super-admin] get_user_id_by_email error (non-blocking):', getUserIdErr)
    }

    if (existingUserId) {
      userId = existingUserId as string
      console.log('[create-super-admin] User already exists, continuing:', userId)
    } else {
      // 2. Create auth user if not found
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      })

      if (authError) {
        console.error('[create-super-admin] Auth error on createUser, will check if user exists:', authError)
        // Retry by checking if the user now exists (handles race conditions / partial previous attempts)
        const { data: maybeUserId, error: retryGetErr } = await supabaseAdmin
          .rpc('get_user_id_by_email', { email_address: email })
        if (retryGetErr) {
          console.error('[create-super-admin] Retry get_user_id_by_email error:', retryGetErr)
        }
        if (maybeUserId) {
          userId = maybeUserId as string
          console.log('[create-super-admin] User found after retry, continuing:', userId)
        } else {
          throw authError
        }
      } else {
        userId = authData!.user.id
        console.log('[create-super-admin] User created:', userId)
      }
    }

    // 3. Ensure profile exists
    const { data: existingProfile, error: profileCheckErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileCheckErr) {
      console.warn('[create-super-admin] Profile check warning (non-blocking):', profileCheckErr)
    }

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: userId, email, name })
      if (profileError) {
        console.error('[create-super-admin] Profile insert error:', profileError)
        throw profileError
      }
      console.log('[create-super-admin] Profile created')
    } else {
      console.log('[create-super-admin] Profile already exists, skipping insert')
    }

    // 4. Ensure super_admin role exists
    const { data: existingRole, error: roleCheckErr } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (roleCheckErr) {
      console.warn('[create-super-admin] Role check warning (non-blocking):', roleCheckErr)
    }

    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'super_admin' })
      if (roleError) {
        console.error('[create-super-admin] Role insert error:', roleError)
        throw roleError
      }
      console.log('[create-super-admin] Role assigned: super_admin')
    } else {
      console.log('[create-super-admin] Role already assigned, skipping insert')
    }

    console.log('[create-super-admin] Super admin created successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Super admin created successfully',
        userId,
        email
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[create-super-admin] Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})