import { NextRequest, NextResponse } from 'next/server'
import { PostmarkService } from '@/lib/services/postmark'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      to,
      subject,
      htmlBody,
      textBody,
      from,
      fromName,
      replyTo,
      tag,
      metadata,
      serverType = 'transactional',
      trackOpens,
      trackLinks
    } = body

    // Validate required fields
    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject' },
        { status: 400 }
      )
    }

    if (!htmlBody && !textBody) {
      return NextResponse.json(
        { error: 'Must provide either htmlBody or textBody' },
        { status: 400 }
      )
    }

    // Initialize Postmark service
    const postmark = new PostmarkService()
    await postmark.initialize(tenantId)
    
    // Use appropriate server
    postmark.useServer(serverType)

    // Get default from settings if not provided
    let fromEmail = from
    if (!fromEmail) {
      const { data: settings } = await supabaseAdmin
        .from('postmark_settings')
        .select('default_from_email, default_from_name')
        .eq('tenant_id', tenantId)
        .single()
      
      if (settings?.default_from_email) {
        fromEmail = settings.default_from_email
      } else {
        return NextResponse.json(
          { error: 'No from email provided and no default configured' },
          { status: 400 }
        )
      }
    }

    // Format from address with name if provided
    const fromAddress = fromName 
      ? `${fromName} <${fromEmail}>`
      : fromEmail

    // Send email
    const result = await postmark.sendEmail({
      from: fromAddress,
      to,
      subject,
      htmlBody,
      textBody,
      replyTo,
      tag,
      metadata: {
        ...metadata,
        tenant_id: tenantId,
        user_id: userId
      },
      trackOpens: trackOpens ?? (serverType === 'marketing'),
      trackLinks: trackLinks ?? (serverType === 'marketing' ? 'HtmlAndText' : 'None')
    })

    // Log activity to contacts.events
    if (Array.isArray(to)) {
      // Log for each recipient
      for (const recipient of to) {
        await logEmailEvent(tenantId, recipient, 'email_sent', {
          subject,
          tag,
          serverType,
          messageId: result.MessageID
        })
      }
    } else {
      await logEmailEvent(tenantId, to, 'email_sent', {
        subject,
        tag,
        serverType,
        messageId: result.MessageID
      })
    }

    return NextResponse.json({
      success: true,
      messageId: result.MessageID,
      submittedAt: result.SubmittedAt
    })

  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}

// Helper function to log email events
async function logEmailEvent(
  tenantId: string,
  email: string,
  eventType: string,
  data: any
) {
  try {
    // Find contact by email
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', email.toLowerCase())
      .single()

    if (contact) {
      await supabaseAdmin
        .from('events')
        .insert({
          tenant_id: tenantId,
          contact_id: contact.id,
          event_type: eventType,
          event_data: data
        })
    }
  } catch (error) {
    console.error('Failed to log email event:', error)
    // Don't throw - logging failure shouldn't stop the response
  }
}