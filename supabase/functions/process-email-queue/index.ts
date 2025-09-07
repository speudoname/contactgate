import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailQueueItem {
  id: string
  tenant_id: string
  to_email: string
  from_email?: string
  subject: string
  html_body?: string
  text_body?: string
  template_id?: string
  template_data?: any
  status: string
  server_mode: 'shared' | 'dedicated'
  message_stream?: string
}

interface PostmarkSettings {
  tenant_id: string
  server_mode: 'shared' | 'dedicated'
  dedicated_api_token?: string
  from_email: string
  from_name?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Postmark API tokens from environment
    const sharedPostmarkToken = Deno.env.get('SHARED_POSTMARK_API_TOKEN')
    
    if (!sharedPostmarkToken) {
      throw new Error('SHARED_POSTMARK_API_TOKEN not configured')
    }

    // Process transactional emails
    const transactionalResults = await processQueue(
      supabase,
      'email_queue_transactional',
      sharedPostmarkToken
    )

    // Process marketing emails
    const marketingResults = await processQueue(
      supabase,
      'email_queue_marketing',
      sharedPostmarkToken
    )

    return new Response(
      JSON.stringify({
        success: true,
        transactional: transactionalResults,
        marketing: marketingResults,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error processing email queue:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function processQueue(
  supabase: any,
  queueTable: string,
  sharedApiToken: string
) {
  const results = {
    processed: 0,
    failed: 0,
    errors: [] as string[]
  }

  try {
    // Get pending emails (limit to 50 per run to avoid timeouts)
    const { data: emails, error: fetchError } = await supabase
      .from(queueTable)
      .select('*')
      .in('status', ['pending', 'retry'])
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      throw fetchError
    }

    if (!emails || emails.length === 0) {
      return results
    }

    // Group emails by tenant to get settings once per tenant
    const emailsByTenant = emails.reduce((acc: any, email: EmailQueueItem) => {
      if (!acc[email.tenant_id]) {
        acc[email.tenant_id] = []
      }
      acc[email.tenant_id].push(email)
      return acc
    }, {})

    // Process each tenant's emails
    for (const [tenantId, tenantEmails] of Object.entries(emailsByTenant)) {
      // Get tenant's Postmark settings
      const { data: settings, error: settingsError } = await supabase
        .from('postmark_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

      if (settingsError || !settings) {
        console.error(`No Postmark settings for tenant ${tenantId}`)
        // Mark emails as failed
        for (const email of tenantEmails as EmailQueueItem[]) {
          await markEmailFailed(supabase, queueTable, email.id, 'No Postmark settings configured')
          results.failed++
        }
        continue
      }

      // Process each email for this tenant
      for (const email of tenantEmails as EmailQueueItem[]) {
        try {
          // Determine which API token to use
          const apiToken = email.server_mode === 'dedicated' && settings.dedicated_api_token
            ? settings.dedicated_api_token
            : sharedApiToken

          // Send via Postmark
          const postmarkResponse = await sendViaPostmark(email, settings, apiToken)

          if (postmarkResponse.success) {
            // Mark as sent
            await markEmailSent(supabase, queueTable, email.id, postmarkResponse.messageId)
            results.processed++
          } else {
            // Mark as failed
            await markEmailFailed(supabase, queueTable, email.id, postmarkResponse.error)
            results.failed++
            results.errors.push(postmarkResponse.error)
          }
        } catch (emailError: any) {
          console.error(`Error processing email ${email.id}:`, emailError)
          await markEmailFailed(supabase, queueTable, email.id, emailError.message)
          results.failed++
          results.errors.push(emailError.message)
        }
      }
    }
  } catch (error: any) {
    console.error(`Error processing ${queueTable}:`, error)
    results.errors.push(error.message)
  }

  return results
}

async function sendViaPostmark(
  email: EmailQueueItem,
  settings: PostmarkSettings,
  apiToken: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const postmarkUrl = 'https://api.postmarkapp.com/email'
    
    // Build email payload
    const payload: any = {
      From: email.from_email || `${settings.from_name || 'No Reply'} <${settings.from_email}>`,
      To: email.to_email,
      Subject: email.subject,
      MessageStream: email.message_stream || 'outbound'
    }

    // Add body content
    if (email.html_body) {
      payload.HtmlBody = email.html_body
    }
    if (email.text_body) {
      payload.TextBody = email.text_body
    }

    // If using template
    if (email.template_id) {
      delete payload.Subject // Template has its own subject
      delete payload.HtmlBody
      delete payload.TextBody
      payload.TemplateId = email.template_id
      payload.TemplateModel = email.template_data || {}
    }

    const response = await fetch(postmarkUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiToken
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        messageId: result.MessageID
      }
    } else {
      return {
        success: false,
        error: result.Message || 'Failed to send email'
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function markEmailSent(
  supabase: any,
  queueTable: string,
  emailId: string,
  messageId: string
) {
  const { error } = await supabase
    .from(queueTable)
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      postmark_message_id: messageId,
      error_message: null,
      retry_count: 0
    })
    .eq('id', emailId)

  if (error) {
    console.error(`Failed to mark email ${emailId} as sent:`, error)
  }
}

async function markEmailFailed(
  supabase: any,
  queueTable: string,
  emailId: string,
  errorMessage: string
) {
  // Get current retry count
  const { data: email } = await supabase
    .from(queueTable)
    .select('retry_count')
    .eq('id', emailId)
    .single()

  const retryCount = (email?.retry_count || 0) + 1
  const maxRetries = 3

  const updateData: any = {
    error_message: errorMessage,
    retry_count: retryCount,
    last_error_at: new Date().toISOString()
  }

  // If under max retries, schedule for retry
  if (retryCount < maxRetries) {
    updateData.status = 'retry'
    // Exponential backoff: 5 min, 15 min, 45 min
    const delayMinutes = Math.pow(3, retryCount) * 5
    const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000)
    updateData.scheduled_for = nextRetry.toISOString()
  } else {
    updateData.status = 'failed'
  }

  const { error } = await supabase
    .from(queueTable)
    .update(updateData)
    .eq('id', emailId)

  if (error) {
    console.error(`Failed to mark email ${emailId} as failed:`, error)
  }
}