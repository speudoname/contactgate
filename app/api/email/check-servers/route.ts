import { NextRequest, NextResponse } from 'next/server'
import { PostmarkService } from '@/lib/services/postmark'
import { supabaseAdmin } from '@/lib/supabase/server'

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

    // Get tenant's postmark_id
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('postmark_id, name, email_tier')
      .eq('id', tenantId)
      .single()
    
    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      )
    }
    
    if (!tenant.postmark_id) {
      return NextResponse.json({
        postmarkId: null,
        serversExist: false,
        message: 'Postmark ID not set for tenant'
      })
    }
    
    // Initialize service and check servers
    const postmark = new PostmarkService()
    await postmark.initialize(tenantId)
    
    // Get current status
    const status = postmark.getStatus()
    
    // Check if servers exist in Postmark
    let serverCheck = null
    if (tenant.postmark_id && process.env.POSTMARK_ACCOUNT_TOKEN) {
      try {
        serverCheck = await postmark.checkServersExist(tenant.postmark_id)
      } catch (error) {
        console.error('Error checking servers:', error)
        // Don't fail the whole request if server check fails
      }
    }
    
    return NextResponse.json({
      postmarkId: tenant.postmark_id,
      tenantName: tenant.name,
      emailTier: tenant.email_tier,
      mode: status.mode,
      isActivated: status.isActivated,
      canActivate: status.canActivate,
      serversExist: serverCheck ? (serverCheck.transactionalExists && serverCheck.marketingExists) : false,
      serverDetails: serverCheck,
      tierLimits: await getTierLimits(tenant.email_tier)
    })
    
  } catch (error) {
    console.error('Server check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getTierLimits(tier: string) {
  const { data } = await supabaseAdmin
    .from('email_tier_limits')
    .select('*')
    .eq('tier', tier || 'free')
    .single()
  
  return data
}