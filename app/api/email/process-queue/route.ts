import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated via JWT
    const cookieStore = await cookies()
    const token = cookieStore.get('jwt-token')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token' },
        { status: 401 }
      )
    }
    
    // Verify JWT token
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
      await jwtVerify(token.value, secret)
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Get the Edge Function URL from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    // Call the Edge Function
    const functionUrl = `${supabaseUrl}/functions/v1/process-email-queue`
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Edge Function error:', errorText)
      return NextResponse.json(
        { error: 'Failed to process email queue', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'Email queue processing triggered',
      result
    })

  } catch (error) {
    console.error('Process queue error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger email processing' },
      { status: 500 }
    )
  }
}