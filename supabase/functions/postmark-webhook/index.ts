import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Parse webhook payload
    const payload = await req.json()
    
    // Extract server ID from webhook to identify tenant
    // Postmark sends ServerID in webhook payloads
    const serverId = payload.ServerID
    
    if (!serverId) {
      console.error('No ServerID in webhook payload')
      return new Response(
        JSON.stringify({ error: 'ServerID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up tenant by server ID
    const { data: settings, error: settingsError } = await supabase
      .schema('contacts')
      .from('postmark_settings')
      .select('tenant_id')
      .or(`transactional_server_id.eq.${serverId},marketing_server_id.eq.${serverId}`)
      .single()

    if (settingsError || !settings) {
      console.error('Could not find tenant for server ID:', serverId)
      // Still return 200 to Postmark to avoid retries
      return new Response(
        JSON.stringify({ status: 'received', warning: 'Unknown server' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantId = settings.tenant_id

    // Determine webhook type from payload
    let eventType = 'unknown'
    let eventData: any = {}

    // Bounce webhook
    if (payload.Type && payload.Email) {
      eventType = payload.Type.toLowerCase() // 'hardbounce', 'softbounce', etc.
      eventData = {
        email: payload.Email,
        message_id: payload.MessageID,
        description: payload.Description,
        details: payload.Details,
        bounce_type: payload.Type,
        inactive: payload.Inactive,
        can_activate: payload.CanActivate,
        timestamp: payload.BouncedAt
      }
    }
    // Delivery webhook
    else if (payload.RecordType === 'Delivery') {
      eventType = 'delivery'
      eventData = {
        email: payload.Recipient,
        message_id: payload.MessageID,
        delivered_at: payload.DeliveredAt,
        details: payload.Details,
        server_id: payload.ServerID,
        tag: payload.Tag
      }
    }
    // Open tracking webhook
    else if (payload.RecordType === 'Open') {
      eventType = 'open'
      eventData = {
        email: payload.Recipient,
        message_id: payload.MessageID,
        first_open: payload.FirstOpen,
        client: payload.Client,
        os: payload.OS,
        platform: payload.Platform,
        user_agent: payload.UserAgent,
        geo: payload.Geo,
        timestamp: payload.ReceivedAt
      }
    }
    // Click webhook
    else if (payload.RecordType === 'Click') {
      eventType = 'click'
      eventData = {
        email: payload.Recipient,
        message_id: payload.MessageID,
        link: payload.OriginalLink,
        click_location: payload.ClickLocation,
        client: payload.Client,
        os: payload.OS,
        platform: payload.Platform,
        user_agent: payload.UserAgent,
        geo: payload.Geo,
        timestamp: payload.ReceivedAt
      }
    }
    // Spam complaint webhook
    else if (payload.RecordType === 'SpamComplaint') {
      eventType = 'spam_complaint'
      eventData = {
        email: payload.Recipient,
        message_id: payload.MessageID,
        complaint_at: payload.BouncedAt,
        details: payload.Details,
        tag: payload.Tag
      }
    }
    // Subscription change webhook
    else if (payload.RecordType === 'SubscriptionChange') {
      eventType = 'subscription_change'
      eventData = {
        email: payload.Recipient,
        suppression_reason: payload.SuppressionReason,
        change_type: payload.ChangedAt ? 'suppressed' : 'reactivated',
        origin: payload.Origin,
        timestamp: payload.ChangedAt
      }
    }
    // Inbound email webhook
    else if (payload.FromFull) {
      eventType = 'inbound'
      eventData = {
        from_email: payload.FromFull.Email,
        from_name: payload.FromFull.Name,
        to: payload.To,
        cc: payload.Cc,
        subject: payload.Subject,
        message_id: payload.MessageID,
        text_body: payload.TextBody,
        html_body: payload.HtmlBody,
        attachments: payload.Attachments,
        timestamp: payload.Date
      }
    }

    // Store webhook event in database
    const { error: insertError } = await supabase
      .schema('contacts')
      .from('email_webhook_events')
      .insert({
        tenant_id: tenantId,
        event_type: eventType,
        server_id: serverId,
        message_id: eventData.message_id || payload.MessageID,
        recipient_email: eventData.email || payload.Recipient || payload.Email,
        event_data: eventData,
        raw_payload: payload,
        processed_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Error storing webhook event:', insertError)
      // Still return 200 to avoid Postmark retries
    }

    // If it's a bounce or spam complaint, update contact status
    if (eventType === 'hardbounce' || eventType === 'spam_complaint') {
      const { error: updateError } = await supabase
        .schema('contacts')
        .from('contacts')
        .update({
          email_status: eventType === 'hardbounce' ? 'bounced' : 'unsubscribed',
          email_status_updated_at: new Date().toISOString(),
          email_status_reason: eventType
        })
        .eq('tenant_id', tenantId)
        .eq('email', eventData.email || payload.Email)

      if (updateError) {
        console.error('Error updating contact status:', updateError)
      }
    }

    // Log event for monitoring
    console.log(`Processed ${eventType} webhook for tenant ${tenantId}`)

    return new Response(
      JSON.stringify({ status: 'received', event_type: eventType }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    // Return 200 to prevent Postmark from retrying
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})