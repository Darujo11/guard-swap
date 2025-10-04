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

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })

    if (authError) {
      console.error('[create-super-admin] Auth error:', authError)
      throw authError
    }

    const userId = authData.user.id
    console.log('[create-super-admin] User created:', userId)

    // 2. Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        email,
        name,
      })

    if (profileError) {
      console.error('[create-super-admin] Profile error:', profileError)
      throw profileError
    }

    // 3. Get profile id
    const { data: profile, error: getProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (getProfileError || !profile) {
      console.error('[create-super-admin] Get profile error:', getProfileError)
      throw getProfileError || new Error('Profile not found')
    }

    // 4. Assign super_admin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'super_admin'
      })

    if (roleError) {
      console.error('[create-super-admin] Role error:', roleError)
      throw roleError
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