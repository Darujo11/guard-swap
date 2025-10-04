import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function toE164BR(raw: string) {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return `+${digits}`
  return `+55${digits}`
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

    const { phone, password, name, email } = await req.json()

    if (!phone || !password || !name) {
      return new Response(JSON.stringify({ error: 'phone, password e name são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const e164 = toE164BR(phone)
    const profileEmail = (email && typeof email === 'string' && email.includes('@'))
      ? email
      : `${(phone || '').replace(/\D/g, '')}@guardshift.com`

    console.log('[create-super-admin-phone] Processing super admin:', { e164, profileEmail, name })

    // 1. Try to find existing user by email
    let userId: string | null = null
    const { data: existingUserId } = await supabaseAdmin.rpc('get_user_id_by_email', { 
      email_address: profileEmail 
    })

    if (existingUserId) {
      userId = existingUserId as string
      console.log('[create-super-admin-phone] User already exists:', userId)
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        phone: e164,
        email: profileEmail,
        password,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: { name }
      })

      if (authError) {
        console.error('[create-super-admin-phone] Auth error:', authError)
        throw authError
      }

      userId = authData.user.id
      console.log('[create-super-admin-phone] User created:', userId)
    }

    // 2. Ensure profile exists (upsert)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: userId, email: profileEmail, name })

      if (profileError) {
        console.error('[create-super-admin-phone] Profile insert error:', profileError)
        throw profileError
      }
      console.log('[create-super-admin-phone] Profile created')
    } else {
      console.log('[create-super-admin-phone] Profile already exists')
    }

    // 3. Delete any existing roles for this user to ensure clean state
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    // 4. Assign super_admin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'super_admin' })

    if (roleError) {
      console.error('[create-super-admin-phone] Role error:', roleError)
      throw roleError
    }

    console.log('[create-super-admin-phone] Super admin created successfully')

    return new Response(
      JSON.stringify({ success: true, message: 'Super admin criado com sucesso', userId, phone: e164 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('[create-super-admin-phone] Error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})