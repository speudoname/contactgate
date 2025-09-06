import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  // Allow public assets and API routes that don't need auth
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/api/health')
  ) {
    return NextResponse.next()
  }

  try {
    // Get token from various sources
    let token = request.nextUrl.searchParams.get('token')
    
    if (!token) {
      // Try to get from Authorization header
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }
    
    if (!token) {
      // Try to get from cookies
      token = request.cookies.get('auth-token')?.value || null
    }

    if (!token) {
      console.log('No token found in request')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify JWT token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    
    // Add tenant and user context to headers for API routes
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-id', payload.tenant_id as string)
    requestHeaders.set('x-user-id', payload.user_id as string)
    requestHeaders.set('x-user-email', payload.email as string)
    requestHeaders.set('x-user-role', payload.role as string || 'user')
    
    // Store token in cookie for subsequent requests
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    
    // Set cookie with token for easier subsequent requests
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })
    
    return response
  } catch (error) {
    console.error('JWT verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    )
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}