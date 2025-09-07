import { NextRequest, NextResponse } from 'next/server'

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

    const accountToken = process.env.POSTMARK_ACCOUNT_TOKEN
    if (!accountToken) {
      return NextResponse.json(
        { error: 'POSTMARK_ACCOUNT_TOKEN not configured' },
        { status: 500 }
      )
    }

    // Fetch all servers from Postmark
    const response = await fetch('https://api.postmarkapp.com/servers', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Postmark-Account-Token': accountToken
      }
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `Failed to fetch servers: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Return simplified server list
    const servers = (data.Servers || []).map((server: any) => ({
      ID: server.ID,
      Name: server.Name,
      Color: server.Color,
      TrackOpens: server.TrackOpens,
      TrackLinks: server.TrackLinks,
      InboundHookUrl: server.InboundHookUrl,
      BounceHookUrl: server.BounceHookUrl,
      OpenHookUrl: server.OpenHookUrl,
      ClickHookUrl: server.ClickHookUrl,
      DeliveryHookUrl: server.DeliveryHookUrl,
      ApiTokens: server.ApiTokens || []
    }))

    return NextResponse.json({ servers })
    
  } catch (error) {
    console.error('Server fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}