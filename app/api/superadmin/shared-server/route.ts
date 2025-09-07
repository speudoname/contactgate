import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseContacts } from '@/lib/supabase/server'

// GET: Fetch shared server info from Postmark
export async function GET(request: NextRequest) {
  try {
    // This endpoint should be protected - only super admins
    // For now, we'll check for a special header or you can add proper auth
    const isSuperAdmin = request.headers.get('x-super-admin') === 'true'
    
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin only' },
        { status: 401 }
      )
    }

    const accountToken = process.env.POSTMARK_ACCOUNT_TOKEN
    
    if (!accountToken) {
      return NextResponse.json(
        { error: 'POSTMARK_ACCOUNT_TOKEN not configured' },
        { status: 500 }
      )
    }

    // List all servers to find defaultsharednumgate
    const serversResponse = await fetch('https://api.postmarkapp.com/servers', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Postmark-Account-Token': accountToken
      }
    })

    if (!serversResponse.ok) {
      throw new Error(`Failed to fetch servers: ${serversResponse.statusText}`)
    }

    const serversData = await serversResponse.json()
    const servers = serversData.Servers || []
    
    // Find the shared server
    const sharedServer = servers.find((s: any) => 
      s.Name === 'defaultsharednumgate' || 
      s.Name.toLowerCase().includes('shared') ||
      s.Name.toLowerCase().includes('default')
    )
    
    if (!sharedServer) {
      return NextResponse.json({
        error: 'Shared server "defaultsharednumgate" not found',
        availableServers: servers.map((s: any) => ({ id: s.ID, name: s.Name }))
      }, { status: 404 })
    }

    // Get server details including streams
    const serverDetailsResponse = await fetch(`https://api.postmarkapp.com/servers/${sharedServer.ID}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Postmark-Account-Token': accountToken
      }
    })

    if (!serverDetailsResponse.ok) {
      throw new Error(`Failed to fetch server details: ${serverDetailsResponse.statusText}`)
    }

    const serverDetails = await serverDetailsResponse.json()

    // Get message streams for this server
    const streamsResponse = await fetch(`https://api.postmarkapp.com/message-streams?ServerId=${sharedServer.ID}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Postmark-Server-Token': sharedServer.ApiTokens?.[0] || accountToken
      }
    })

    let streams = []
    if (streamsResponse.ok) {
      const streamsData = await streamsResponse.json()
      streams = streamsData.MessageStreams || []
    }

    // Get the current shared config from database
    const { data: currentConfig } = await supabaseContacts
      .from('shared_postmark_config')
      .select('*')
      .single()

    return NextResponse.json({
      server: {
        id: sharedServer.ID,
        name: sharedServer.Name,
        color: sharedServer.Color,
        trackOpens: sharedServer.TrackOpens,
        trackLinks: sharedServer.TrackLinks,
        hasApiTokens: sharedServer.ApiTokens?.length > 0
      },
      streams: streams.map((s: any) => ({
        id: s.ID,
        name: s.Name,
        type: s.MessageStreamType,
        description: s.Description
      })),
      currentConfig,
      note: 'Server token cannot be retrieved via API. You need to get it from Postmark dashboard or create a new one.'
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
      server_token,
      server_id,
      transactional_stream_id = 'outbound',
      marketing_stream_id = 'broadcasts'
    } = body

    if (!server_token) {
      return NextResponse.json(
        { error: 'Server token is required' },
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
          transactional_server_token: server_token,
          transactional_server_id: server_id,
          transactional_stream_id,
          marketing_server_token: server_token, // Same server for both
          marketing_server_id: server_id,
          marketing_stream_id,
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
          transactional_server_token: server_token,
          transactional_server_id: server_id,
          transactional_stream_id,
          marketing_server_token: server_token,
          marketing_server_id: server_id,
          marketing_stream_id,
          default_from_email: 'share@share.komunate.com',
          default_from_name: 'Komunate Platform',
          default_reply_to: 'noreply@komunate.com'
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