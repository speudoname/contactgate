import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseContacts } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch settings from contacts.postmark_settings
    let { data: settings, error } = await supabaseContacts
      .from('postmark_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    // If no settings exist, create default shared mode settings
    if (error && error.code === 'PGRST116') { // PGRST116 = no rows returned
      const { data: newSettings, error: createError } = await supabaseContacts
        .from('postmark_settings')
        .insert({
          tenant_id: tenantId,
          server_mode: 'shared',
          activation_status: 'pending'
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Error creating settings:', createError)
        return NextResponse.json(
          { error: 'Failed to create settings' },
          { status: 500 }
        )
      }
      
      settings = newSettings
    } else if (error) {
      console.error('Error fetching settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    // If in shared mode, fetch and merge shared configuration
    if (settings?.server_mode === 'shared') {
      const { data: sharedConfig } = await supabaseContacts
        .from('shared_postmark_config')
        .select('*')
        .single()
      
      // Merge shared config with tenant-specific settings
      settings = {
        ...settings,
        // Use shared server tokens if in shared mode
        transactional_server_token: sharedConfig?.transactional_server_token || '',
        transactional_stream_id: sharedConfig?.transactional_stream_id || 'transactional-shared',
        marketing_server_token: sharedConfig?.marketing_server_token || '',
        marketing_stream_id: sharedConfig?.marketing_stream_id || 'marketing-shared',
        // Use custom or default from emails
        default_from_email: settings.custom_from_email || sharedConfig?.default_from_email || 'share@share.komunate.com',
        default_from_name: settings.custom_from_name || sharedConfig?.default_from_name || 'Komunate',
        default_reply_to: settings.custom_reply_to || sharedConfig?.default_reply_to || 'noreply@komunate.com'
      }
    }

    // Add account token from environment
    settings.account_token = process.env.POSTMARK_ACCOUNT_TOKEN || ''

    // Get tenant info for additional context
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('postmark_id, email_tier, email_monthly_limit')
      .eq('id', tenantId)
      .single()

    return NextResponse.json({ 
      settings,
      tenant: {
        postmark_id: tenant?.postmark_id,
        email_tier: tenant?.email_tier || 'free',
        email_monthly_limit: tenant?.email_monthly_limit || 1000
      }
    })

  } catch (error) {
    console.error('Settings fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const settings = await request.json()

    // Remove any id field to prevent conflicts
    delete settings.id

    // Check if settings already exist
    const { data: existing } = await supabaseContacts
      .from('postmark_settings')
      .select('id')
      .eq('tenant_id', tenantId)
      .single()

    let result

    if (existing) {
      // Update existing settings
      const { data, error } = await supabaseContacts
        .from('postmark_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (error) {
        console.error('Error updating settings:', error)
        return NextResponse.json(
          { error: 'Failed to update settings' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new settings
      const { data, error } = await supabaseContacts
        .from('postmark_settings')
        .insert({
          ...settings,
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating settings:', error)
        return NextResponse.json(
          { error: 'Failed to create settings' },
          { status: 500 }
        )
      }

      result = data
    }

    // Also update postmark_id in tenants table if provided
    if (settings.postmark_id) {
      await supabaseAdmin
        .from('tenants')
        .update({ postmark_id: settings.postmark_id })
        .eq('id', tenantId)
    }

    return NextResponse.json({ 
      success: true,
      settings: result
    })

  } catch (error) {
    console.error('Settings save error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}