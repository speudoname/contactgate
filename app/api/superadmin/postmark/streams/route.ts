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

    const searchParams = request.nextUrl.searchParams
    const serverId = searchParams.get('serverId')
    const serverToken = searchParams.get('token')

    if (!serverId || !serverToken) {
      return NextResponse.json(
        { error: 'serverId and token are required' },
        { status: 400 }
      )
    }

    // Fetch streams for the specific server
    const response = await fetch(`https://api.postmarkapp.com/message-streams`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Postmark-Server-Token': serverToken
      }
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `Failed to fetch streams: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Return streams
    const streams = (data.MessageStreams || []).map((stream: any) => ({
      ID: stream.ID,
      ServerID: stream.ServerID,
      Name: stream.Name,
      MessageStreamType: stream.MessageStreamType,
      Description: stream.Description,
      CreatedAt: stream.CreatedAt,
      UpdatedAt: stream.UpdatedAt,
      SubscriptionManagementConfiguration: stream.SubscriptionManagementConfiguration
    }))

    return NextResponse.json({ streams })
    
  } catch (error) {
    console.error('Streams fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}