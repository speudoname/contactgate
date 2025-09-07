import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseContacts } from '@/lib/supabase/server'

// GET: Fetch current shared server configuration
export async function GET(request: NextRequest) {
  try {
    // Check super-admin authorization
    const isSuperAdmin = request.headers.get('x-super-admin') === 'true'
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin only' },
        { status: 401 }
      )
    }

    // Get the current shared config from database
    const { data: currentConfig, error } = await supabaseContacts
      .from('shared_postmark_config')
      .select('*')
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching shared config:', error)
      return NextResponse.json(
        { error: 'Failed to fetch configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      currentConfig: currentConfig || {
        transactional_server_token: '',
        transactional_server_id: null,
        transactional_stream_id: 'outbound',
        marketing_server_token: '',
        marketing_server_id: null,
        marketing_stream_id: 'broadcasts',
        default_from_email: 'share@share.komunate.com',
        default_from_name: 'Komunate Platform',
        default_reply_to: 'noreply@komunate.com'
      }
    })
    
  } catch (error) {
    console.error('Shared server fetch error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch shared server',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// POST: Update shared server configuration
export async function POST(request: NextRequest) {
  try {
    // Super admin check
    const isSuperAdmin = request.headers.get('x-super-admin') === 'true'
    
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin only' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      transactional_server_token,
      transactional_server_id,
      transactional_stream_id = 'outbound',
      marketing_server_token,
      marketing_server_id,
      marketing_stream_id = 'broadcasts',
      default_from_email = 'share@share.komunate.com',
      default_from_name = 'Komunate Platform',
      default_reply_to = 'noreply@komunate.com'
    } = body

    if (!transactional_server_token || !marketing_server_token) {
      return NextResponse.json(
        { error: 'Both transactional and marketing server tokens are required' },
        { status: 400 }
      )
    }

    // Check if config exists
    const { data: existing } = await supabaseContacts
      .from('shared_postmark_config')
      .select('id')
      .single()

    let result
    
    if (existing) {
      // Update existing config
      const { data, error } = await supabaseContacts
        .from('shared_postmark_config')
        .update({
          transactional_server_token,
          transactional_server_id,
          transactional_stream_id,
          marketing_server_token,
          marketing_server_id,
          marketing_stream_id,
          default_from_email,
          default_from_name,
          default_reply_to,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) {
        throw error
      }
      
      result = data
    } else {
      // Create new config
      const { data, error } = await supabaseContacts
        .from('shared_postmark_config')
        .insert({
          transactional_server_token,
          transactional_server_id,
          transactional_stream_id,
          marketing_server_token,
          marketing_server_id,
          marketing_stream_id,
          default_from_email,
          default_from_name,
          default_reply_to
        })
        .select()
        .single()
      
      if (error) {
        throw error
      }
      
      result = data
    }

    return NextResponse.json({
      success: true,
      config: result,
      message: 'Shared server configuration updated successfully'
    })
    
  } catch (error) {
    console.error('Shared server update error:', error)
    return NextResponse.json(
      { error: 'Failed to update shared server configuration' },
      { status: 500 }
    )
  }
}