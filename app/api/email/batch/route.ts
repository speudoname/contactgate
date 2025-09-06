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
      recipients, // Array of email addresses or contact IDs
      useContactIds = false, // Whether recipients are contact IDs
      subject,
      htmlBody,
      textBody,
      from,
      fromName,
      replyTo,
      tag,
      metadata,
      serverType = 'marketing', // Batch is usually for marketing
      trackOpens = true,
      trackLinks = 'HtmlAndText',
      templateId,
      templateAlias,
      templateModel,
      campaignId // Optional campaign ID to link sends
    } = body

    // Validate
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Recipients array is required' },
        { status: 400 }
      )
    }

    if (recipients.length > 500) {
      return NextResponse.json(
        { error: 'Batch size cannot exceed 500 recipients' },
        { status: 400 }
      )
    }

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject is required' },
        { status: 400 }
      )
    }

    if (!htmlBody && !textBody && !templateId && !templateAlias) {
      return NextResponse.json(
        { error: 'Must provide either htmlBody, textBody, or template' },
        { status: 400 }
      )
    }

    // Initialize Postmark service
    const postmark = new PostmarkService()
    await postmark.initialize(tenantId)
    postmark.useServer(serverType)

    // Get email addresses if contact IDs provided
    let emailList: { email: string; name?: string; contactId?: string }[] = []
    
    if (useContactIds) {
      const { data: contacts } = await supabaseAdmin
        .from('contacts')
        .select('id, email, first_name, last_name')
        .eq('tenant_id', tenantId)
        .in('id', recipients)
      
      if (!contacts || contacts.length === 0) {
        return NextResponse.json(
          { error: 'No valid contacts found' },
          { status: 400 }
        )
      }
      
      emailList = contacts.map(c => ({
        email: c.email,
        name: [c.first_name, c.last_name].filter(Boolean).join(' '),
        contactId: c.id
      }))
    } else {
      emailList = recipients.map(email => ({ email }))
    }

    // Filter out suppressed emails
    const validEmails = await postmark.filterValidRecipients(
      emailList.map(e => e.email),
      serverType
    )
    
    const validRecipients = emailList.filter(r => 
      validEmails.includes(r.email)
    )

    if (validRecipients.length === 0) {
      return NextResponse.json(
        { error: 'All recipients are suppressed or invalid' },
        { status: 400 }
      )
    }

    // Get default from settings if not provided
    let fromEmail = from
    if (!fromEmail) {
      const { data: settings } = await supabaseAdmin
        .from('postmark_settings')
        .select('default_from_email, default_from_name')
        .eq('tenant_id', tenantId)
        .single()
      
      fromEmail = settings?.default_from_email || 'noreply@example.com'
    }

    // Format from address
    const fromAddress = fromName 
      ? `${fromName} <${fromEmail}>`
      : fromEmail

    // Prepare batch emails
    const batchEmails = validRecipients.map(recipient => {
      // Personalize if template model provided
      const personalizedModel = templateModel ? {
        ...templateModel,
        recipient_name: recipient.name || recipient.email.split('@')[0],
        recipient_email: recipient.email
      } : undefined

      return {
        from: fromAddress,
        to: recipient.email,
        subject,
        htmlBody,
        textBody,
        replyTo,
        tag,
        metadata: {
          ...metadata,
          tenant_id: tenantId,
          user_id: userId,
          campaign_id: campaignId,
          contact_id: recipient.contactId
        },
        trackOpens,
        trackLinks,
        templateId,
        templateAlias,
        templateModel: personalizedModel
      }
    })

    // Send batch
    const results = await postmark.sendBatch(batchEmails)

    // Update campaign stats if provided
    if (campaignId) {
      const successCount = results.filter(r => r.ErrorCode === 0).length
      const failCount = results.filter(r => r.ErrorCode !== 0).length
      
      await supabaseAdmin
        .from('email_campaigns')
        .update({
          sent_count: successCount,
          status: 'sent',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)
        .eq('tenant_id', tenantId)
    }

    // Log events for successful sends
    for (let i = 0; i < results.length; i++) {
      if (results[i].ErrorCode === 0) {
        const recipient = validRecipients[i]
        await logBatchEmailEvent(
          tenantId,
          recipient.email,
          recipient.contactId,
          'email_sent',
          {
            subject,
            tag,
            serverType,
            campaignId,
            messageId: results[i].MessageID
          }
        )
      }
    }

    // Prepare response
    const successful = results.filter(r => r.ErrorCode === 0)
    const failed = results.filter(r => r.ErrorCode !== 0)

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        sent: successful.length,
        failed: failed.length,
        suppressed: emailList.length - validRecipients.length
      },
      results: results.map((r, i) => ({
        email: validRecipients[i]?.email,
        messageId: r.MessageID,
        success: r.ErrorCode === 0,
        error: r.ErrorCode !== 0 ? r.Message : null
      }))
    })

  } catch (error) {
    console.error('Batch email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send batch emails' },
      { status: 500 }
    )
  }
}

// Helper function to log batch email events
async function logBatchEmailEvent(
  tenantId: string,
  email: string,
  contactId: string | undefined,
  eventType: string,
  data: any
) {
  try {
    // If no contact ID, try to find it
    if (!contactId) {
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', email.toLowerCase())
        .single()
      
      contactId = contact?.id
    }

    if (contactId) {
      await supabaseAdmin
        .from('events')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          event_type: eventType,
          event_data: data
        })
    }
  } catch (error) {
    console.error('Failed to log batch email event:', error)
    // Don't throw - logging failure shouldn't stop the response
  }
}