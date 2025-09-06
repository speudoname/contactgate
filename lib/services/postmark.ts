// Postmark Email Service for ContactGate
// Based on pandaly-super-admin implementation with enhancements for contact management

import { supabaseAdmin } from '@/lib/supabase/server'

// Types
export interface PostmarkSettings {
  postmark_id?: string
  transactional_server_id?: number
  transactional_server_token?: string
  transactional_stream_id?: string
  marketing_server_id?: number
  marketing_server_token?: string
  marketing_stream_id?: string
  track_opens?: boolean
  track_links?: string
  default_from_email?: string
  default_from_name?: string
  default_reply_to?: string
  domain_verified?: boolean
  account_token?: string
}

export interface EmailOptions {
  from: string
  to: string | string[]
  subject: string
  htmlBody?: string
  textBody?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  tag?: string
  metadata?: Record<string, any>
  attachments?: EmailAttachment[]
  trackOpens?: boolean
  trackLinks?: string
  messageStream?: string
  headers?: Record<string, string>
}

export interface EmailAttachment {
  name: string
  content: string // Base64 encoded
  contentType: string
}

export interface EmailTemplate {
  templateId?: number
  templateAlias?: string
  templateModel: Record<string, any>
  from: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  tag?: string
  metadata?: Record<string, any>
  messageStream?: string
}

export interface BatchEmail extends EmailOptions {
  // Each email in batch can have unique properties
}

export interface PostmarkResponse {
  To: string
  SubmittedAt: string
  MessageID: string
  ErrorCode: number
  Message: string
}

export interface PostmarkBounce {
  ID: number
  Type: string
  MessageID: string
  TypeCode: number
  Details: string
  Email: string
  From: string
  BouncedAt: string
  DumpAvailable: boolean
  Inactive: boolean
  CanActivate: boolean
  Subject: string
}

export class PostmarkService {
  private baseUrl = 'https://api.postmarkapp.com'
  private accountToken: string | null = null
  private serverToken: string | null = null
  private tenantId: string | null = null
  private settings: PostmarkSettings | null = null

  constructor(tenantId?: string) {
    this.tenantId = tenantId || null
  }

  // Initialize service with tenant settings
  async initialize(tenantId: string): Promise<void> {
    this.tenantId = tenantId
    
    // Fetch settings from database
    const { data: settings, error } = await supabaseAdmin
      .from('postmark_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()
    
    if (error || !settings) {
      throw new Error(`No Postmark settings found for tenant ${tenantId}`)
    }
    
    this.settings = settings
    this.accountToken = settings.account_token || null
    
    // Default to transactional server token
    this.serverToken = settings.transactional_server_token || null
  }

  // Set which server to use (transactional or marketing)
  useServer(serverType: 'transactional' | 'marketing'): void {
    if (!this.settings) {
      throw new Error('Service not initialized. Call initialize() first.')
    }
    
    if (serverType === 'marketing') {
      this.serverToken = this.settings.marketing_server_token || null
    } else {
      this.serverToken = this.settings.transactional_server_token || null
    }
    
    if (!this.serverToken) {
      throw new Error(`No ${serverType} server token configured`)
    }
  }

  // ============= EMAIL SENDING =============

  // Send single email
  async sendEmail(options: EmailOptions): Promise<PostmarkResponse> {
    if (!this.serverToken) {
      throw new Error('No server token configured')
    }

    const body: any = {
      From: options.from || this.settings?.default_from_email,
      To: Array.isArray(options.to) ? options.to.join(',') : options.to,
      Subject: options.subject,
      HtmlBody: options.htmlBody,
      TextBody: options.textBody,
      Tag: options.tag,
      Metadata: options.metadata,
      MessageStream: options.messageStream || this.settings?.transactional_stream_id || 'outbound',
      TrackOpens: options.trackOpens ?? this.settings?.track_opens ?? false,
      TrackLinks: options.trackLinks || this.settings?.track_links || 'None'
    }

    // Add optional fields
    if (options.cc) body.Cc = Array.isArray(options.cc) ? options.cc.join(',') : options.cc
    if (options.bcc) body.Bcc = Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc
    if (options.replyTo) body.ReplyTo = options.replyTo
    if (options.attachments) body.Attachments = options.attachments
    if (options.headers) body.Headers = Object.entries(options.headers).map(([Name, Value]) => ({ Name, Value }))

    try {
      const response = await fetch(`${this.baseUrl}/email`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`Postmark Error ${data.ErrorCode}: ${data.Message}`)
      }

      // Log the send to database
      await this.logEmailSend({
        tenant_id: this.tenantId!,
        message_id: data.MessageID,
        to_email: options.to.toString(),
        subject: options.subject,
        status: 'sent',
        sent_at: data.SubmittedAt,
        server_type: this.serverToken === this.settings?.marketing_server_token ? 'marketing' : 'transactional',
        message_stream: body.MessageStream,
        tag: options.tag,
        metadata: options.metadata
      })

      return data
    } catch (error) {
      console.error('Failed to send email:', error)
      throw error
    }
  }

  // Send batch emails (up to 500)
  async sendBatch(emails: BatchEmail[]): Promise<PostmarkResponse[]> {
    if (!this.serverToken) {
      throw new Error('No server token configured')
    }

    if (emails.length > 500) {
      throw new Error('Batch size cannot exceed 500 emails')
    }

    const batch = emails.map(email => ({
      From: email.from || this.settings?.default_from_email,
      To: Array.isArray(email.to) ? email.to.join(',') : email.to,
      Subject: email.subject,
      HtmlBody: email.htmlBody,
      TextBody: email.textBody,
      Tag: email.tag,
      Metadata: email.metadata,
      MessageStream: email.messageStream || this.settings?.marketing_stream_id || 'broadcasts',
      TrackOpens: email.trackOpens ?? this.settings?.track_opens ?? true,
      TrackLinks: email.trackLinks || this.settings?.track_links || 'HtmlAndText',
      Cc: email.cc ? (Array.isArray(email.cc) ? email.cc.join(',') : email.cc) : undefined,
      Bcc: email.bcc ? (Array.isArray(email.bcc) ? email.bcc.join(',') : email.bcc) : undefined,
      ReplyTo: email.replyTo,
      Attachments: email.attachments
    }))

    try {
      const response = await fetch(`${this.baseUrl}/email/batch`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        },
        body: JSON.stringify(batch)
      })

      const results = await response.json()
      
      // Log each send
      for (const result of results) {
        if (result.ErrorCode === 0) {
          const emailIndex = results.indexOf(result)
          await this.logEmailSend({
            tenant_id: this.tenantId!,
            message_id: result.MessageID,
            to_email: result.To,
            subject: emails[emailIndex].subject,
            status: 'sent',
            sent_at: result.SubmittedAt,
            server_type: 'marketing',
            message_stream: emails[emailIndex].messageStream || 'broadcasts',
            tag: emails[emailIndex].tag,
            metadata: emails[emailIndex].metadata
          })
        }
      }

      return results
    } catch (error) {
      console.error('Failed to send batch emails:', error)
      throw error
    }
  }

  // Send email with template
  async sendWithTemplate(options: EmailTemplate): Promise<PostmarkResponse> {
    if (!this.serverToken) {
      throw new Error('No server token configured')
    }

    const body: any = {
      TemplateId: options.templateId,
      TemplateAlias: options.templateAlias,
      TemplateModel: options.templateModel,
      From: options.from || this.settings?.default_from_email,
      To: Array.isArray(options.to) ? options.to.join(',') : options.to,
      Tag: options.tag,
      Metadata: options.metadata,
      MessageStream: options.messageStream || this.settings?.transactional_stream_id || 'outbound'
    }

    // Add optional fields
    if (options.cc) body.Cc = Array.isArray(options.cc) ? options.cc.join(',') : options.cc
    if (options.bcc) body.Bcc = Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc
    if (options.replyTo) body.ReplyTo = options.replyTo

    try {
      const response = await fetch(`${this.baseUrl}/email/withTemplate`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`Postmark Error ${data.ErrorCode}: ${data.Message}`)
      }

      // Log the send
      await this.logEmailSend({
        tenant_id: this.tenantId!,
        message_id: data.MessageID,
        to_email: options.to.toString(),
        subject: data.Subject || 'Template Email',
        status: 'sent',
        sent_at: data.SubmittedAt,
        server_type: this.serverToken === this.settings?.marketing_server_token ? 'marketing' : 'transactional',
        message_stream: body.MessageStream,
        tag: options.tag,
        metadata: options.metadata
      })

      return data
    } catch (error) {
      console.error('Failed to send template email:', error)
      throw error
    }
  }

  // ============= BOUNCE MANAGEMENT =============

  // Get bounces
  async getBounces(options?: {
    count?: number
    offset?: number
    type?: string
    inactive?: boolean
    emailFilter?: string
    messageStream?: string
    fromDate?: string
    toDate?: string
  }): Promise<{ TotalCount: number; Bounces: PostmarkBounce[] }> {
    if (!this.serverToken) {
      throw new Error('No server token configured')
    }

    const params = new URLSearchParams()
    if (options?.count) params.append('count', options.count.toString())
    if (options?.offset) params.append('offset', options.offset.toString())
    if (options?.type) params.append('type', options.type)
    if (options?.inactive !== undefined) params.append('inactive', options.inactive.toString())
    if (options?.emailFilter) params.append('emailFilter', options.emailFilter)
    if (options?.messageStream) params.append('messagestream', options.messageStream)
    if (options?.fromDate) params.append('fromdate', options.fromDate)
    if (options?.toDate) params.append('todate', options.toDate)

    try {
      const response = await fetch(`${this.baseUrl}/bounces?${params}`, {
        headers: {
          'Accept': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch bounces: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get bounces:', error)
      throw error
    }
  }

  // Activate a bounce
  async activateBounce(bounceId: number): Promise<boolean> {
    if (!this.serverToken) {
      throw new Error('No server token configured')
    }

    try {
      const response = await fetch(`${this.baseUrl}/bounces/${bounceId}/activate`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        }
      })

      return response.ok
    } catch (error) {
      console.error('Failed to activate bounce:', error)
      return false
    }
  }

  // ============= SUPPRESSION MANAGEMENT =============

  // Add emails to suppression list
  async addSuppressions(emails: string[], messageStream: string = 'broadcasts'): Promise<boolean> {
    if (!this.serverToken) {
      throw new Error('No server token configured')
    }

    try {
      const response = await fetch(`${this.baseUrl}/message-streams/${messageStream}/suppressions`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        },
        body: JSON.stringify({
          Suppressions: emails.map(email => ({ EmailAddress: email }))
        })
      })

      if (response.ok) {
        // Also add to local suppression list
        for (const email of emails) {
          await supabaseAdmin
            .from('email_suppressions')
            .insert({
              tenant_id: this.tenantId,
              email: email.toLowerCase(),
              suppression_type: 'unsubscribe',
              reason: 'Added via API',
              origin: 'system',
              applies_to: messageStream === 'broadcasts' ? 'marketing' : 'all'
            })
            .select()
            .single()
        }
      }

      return response.ok
    } catch (error) {
      console.error('Failed to add suppressions:', error)
      return false
    }
  }

  // Remove email from suppression list
  async removeSuppressions(emails: string[], messageStream: string = 'broadcasts'): Promise<boolean> {
    if (!this.serverToken) {
      throw new Error('No server token configured')
    }

    try {
      // Postmark requires individual DELETE requests
      const results = await Promise.all(
        emails.map(async email => {
          const response = await fetch(
            `${this.baseUrl}/message-streams/${messageStream}/suppressions/${encodeURIComponent(email)}`,
            {
              method: 'DELETE',
              headers: {
                'Accept': 'application/json',
                'X-Postmark-Server-Token': this.serverToken!
              }
            }
          )
          
          if (response.ok) {
            // Remove from local suppression list
            await supabaseAdmin
              .from('email_suppressions')
              .delete()
              .eq('tenant_id', this.tenantId)
              .eq('email', email.toLowerCase())
          }
          
          return response.ok
        })
      )

      return results.every(result => result)
    } catch (error) {
      console.error('Failed to remove suppressions:', error)
      return false
    }
  }

  // ============= STATISTICS =============

  // Get outbound statistics
  async getStats(options?: {
    fromDate?: string
    toDate?: string
    messageStream?: string
    tag?: string
  }): Promise<any> {
    if (!this.serverToken) {
      throw new Error('No server token configured')
    }

    const params = new URLSearchParams()
    if (options?.fromDate) params.append('fromdate', options.fromDate)
    if (options?.toDate) params.append('todate', options.toDate)
    if (options?.messageStream) params.append('messagestream', options.messageStream)
    if (options?.tag) params.append('tag', options.tag)

    try {
      const response = await fetch(`${this.baseUrl}/stats/outbound?${params}`, {
        headers: {
          'Accept': 'application/json',
          'X-Postmark-Server-Token': this.serverToken
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get stats:', error)
      throw error
    }
  }

  // ============= HELPER METHODS =============

  // Log email send to database
  private async logEmailSend(data: {
    tenant_id: string
    message_id: string
    to_email: string
    subject: string
    status: string
    sent_at: string
    server_type: string
    message_stream: string
    tag?: string
    metadata?: any
    campaign_id?: string
    contact_id?: string
  }): Promise<void> {
    try {
      // Find contact by email if not provided
      if (!data.contact_id && data.to_email) {
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('id')
          .eq('tenant_id', data.tenant_id)
          .eq('email', data.to_email.toLowerCase())
          .single()
        
        if (contact) {
          data.contact_id = contact.id
        }
      }

      await supabaseAdmin
        .from('email_sends')
        .insert({
          ...data,
          to_email: data.to_email.toLowerCase()
        })
    } catch (error) {
      console.error('Failed to log email send:', error)
      // Don't throw - logging failure shouldn't stop email sending
    }
  }

  // Check if email is suppressed
  async isEmailSuppressed(email: string, emailType: 'marketing' | 'transactional' = 'marketing'): Promise<boolean> {
    if (!this.tenantId) {
      throw new Error('Service not initialized')
    }

    const { data } = await supabaseAdmin
      .from('email_suppressions')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .eq('email', email.toLowerCase())
      .or(`applies_to.eq.all,applies_to.eq.${emailType}`)
      .single()

    return !!data
  }

  // Get valid recipients (not suppressed, not bounced)
  async filterValidRecipients(emails: string[], emailType: 'marketing' | 'transactional' = 'marketing'): Promise<string[]> {
    if (!this.tenantId) {
      throw new Error('Service not initialized')
    }

    const { data: suppressions } = await supabaseAdmin
      .from('email_suppressions')
      .select('email')
      .eq('tenant_id', this.tenantId)
      .or(`applies_to.eq.all,applies_to.eq.${emailType}`)
      .in('email', emails.map(e => e.toLowerCase()))

    const suppressedEmails = new Set(suppressions?.map(s => s.email.toLowerCase()) || [])
    
    return emails.filter(email => !suppressedEmails.has(email.toLowerCase()))
  }
}

// Export singleton instance for default tenant
export const postmarkService = new PostmarkService()