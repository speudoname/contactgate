import { NextRequest, NextResponse } from 'next/server'
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
    const { to, mode } = await request.json()

    if (!to) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      )
    }

    // Get tenant settings to determine from email
    const { data: settings } = await supabaseAdmin
      .from('postmark_settings')
      .select('server_mode, custom_from_email, custom_from_name, default_from_email, default_from_name')
      .eq('tenant_id', tenantId)
      .single()

    const isSharedMode = !settings || settings.server_mode === 'shared'
    const fromEmail = settings?.custom_from_email || settings?.default_from_email || 'test@komunate.com'
    const fromName = settings?.custom_from_name || settings?.default_from_name || 'Komunate Test'

    // Create test email content
    const testEmail = {
      tenant_id: tenantId,
      to_email: to,
      from_email: fromEmail,
      from_name: fromName,
      subject: `Test Email - ${isSharedMode ? 'Shared' : 'Dedicated'} Mode - ${new Date().toLocaleString()}`,
      html_body: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Test Email from ContactGate</h1>
            </div>
            <div class="content">
              <h2>Email Queue System Test</h2>
              <p>This test email was sent through the new email queue system.</p>
              
              <div class="info">
                <h3>Configuration Details:</h3>
                <ul>
                  <li><strong>Mode:</strong> ${isSharedMode ? 'Shared Infrastructure' : 'Dedicated Servers'}</li>
                  <li><strong>From:</strong> ${fromEmail}</li>
                  <li><strong>Queue Type:</strong> Transactional (High Priority)</li>
                  <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
                  <li><strong>Tenant ID:</strong> ${tenantId}</li>
                </ul>
              </div>
              
              <p>If you received this email, your email queue system is working correctly!</p>
              
              <div class="info" style="border-left-color: #28a745;">
                <h3>✅ What this confirms:</h3>
                <ul>
                  <li>Email was successfully added to the queue</li>
                  <li>Queue processor picked it up</li>
                  <li>Postmark API accepted and delivered it</li>
                  <li>Your email configuration is correct</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>Sent from ContactGate Email Queue System</p>
              <p>Powered by Komunate Platform</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text_body: `Test Email from ContactGate\n\nThis test email was sent through the new email queue system.\n\nConfiguration:\n- Mode: ${isSharedMode ? 'Shared' : 'Dedicated'}\n- From: ${fromEmail}\n- Queue: Transactional\n- Time: ${new Date().toISOString()}\n\nIf you received this email, your configuration is working correctly!`,
      priority: 10, // High priority for test emails
      tag: 'test-email',
      metadata: {
        type: 'test',
        requested_by: userId,
        timestamp: new Date().toISOString()
      }
    }

    // Add to transactional email queue
    const { data, error } = await supabaseAdmin
      .from('email_queue_transactional')
      .insert(testEmail)
      .select()
      .single()

    if (error) {
      console.error('Failed to queue test email:', error)
      return NextResponse.json(
        { error: 'Failed to queue test email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Test email queued successfully! It will be processed within 30 seconds.`,
      queue_id: data.id,
      details: {
        to: to,
        from: fromEmail,
        mode: isSharedMode ? 'shared' : 'dedicated',
        priority: 'high',
        queue_type: 'transactional'
      }
    })

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}