import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Allow public assets
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next()
  }

  // Check if request is coming from NUMgate proxy
  const isProxied = request.headers.get('x-proxied-from') === 'numgate'
  
  if (isProxied) {
    // Trust NUMgate's authentication completely - no JWT validation needed
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      // Proxied but no auth headers means user is not authenticated
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Request is authenticated via proxy - pass through
    return NextResponse.next()
  }

  // For direct access (development only)
  // In production, ContactGate should always be accessed via NUMgate
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    // Redirect to gateway login
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://numgate.vercel.app'
    return NextResponse.redirect(new URL('/login', gatewayUrl))
  }

  // For direct access in development, we just check token exists
  // Real validation happens in NUMgate
  try {
    const requestHeaders = new Headers(request.headers)
    // In dev mode, basic headers for compatibility
    // These would normally come from NUMgate proxy
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://numgate.vercel.app'
    return NextResponse.redirect(new URL('/login', gatewayUrl))
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