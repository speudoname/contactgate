import { NextRequest, NextResponse } from 'next/server'
import { PostmarkService } from '@/lib/services/postmark'

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

    // Initialize Postmark service
    const postmark = new PostmarkService()
    await postmark.initialize(tenantId)
    
    // Check current status
    const status = postmark.getStatus()
    
    if (status.isActivated) {
      return NextResponse.json(
        { error: 'Email service already activated' },
        { status: 400 }
      )
    }
    
    if (!status.canActivate) {
      return NextResponse.json(
        { error: 'Cannot activate: Postmark ID not set for tenant' },
        { status: 400 }
      )
    }
    
    // Activate the service (creates servers)
    await postmark.activateEmailService()
    
    return NextResponse.json({
      success: true,
      message: 'Email service activated successfully',
      status: 'active'
    })
    
  } catch (error) {
    console.error('Activation error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to activate email service',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}