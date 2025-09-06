# Postmark Complete API Documentation for ContactGate Email System

## Overview
Postmark is a transactional and marketing email service provider. Based on the pandaly-super-admin implementation, here's how we understand and will implement it in ContactGate.

## How Postmark is Implemented in Pandaly-Super-Admin

### Database Structure
Each tenant has:
1. **postmark_id** (VARCHAR(6)) - Unique identifier like "AIA001" 
   - Format: 3 letters (from tenant name) + 3 numbers
   - Used for naming conventions across Postmark

2. **postmark_settings table** containing:
   ```sql
   - transactional_server_id (INTEGER)
   - transactional_server_name (TEXT)
   - transactional_server_token (TEXT) 
   - transactional_stream_id (TEXT) - default 'outbound'
   - marketing_server_id (INTEGER)
   - marketing_server_name (TEXT)
   - marketing_server_token (TEXT)
   - marketing_stream_id (TEXT) - default 'broadcasts'
   - track_opens (BOOLEAN)
   - track_links (TEXT) - 'None', 'HtmlAndText', 'HtmlOnly', 'TextOnly'
   - domain_id (INTEGER)
   - domain_name (TEXT)
   - domain_verified (BOOLEAN)
   ```

### Key Concepts

#### 1. Two Server Types per Tenant
- **Transactional Server**: For order confirmations, password resets, etc.
  - Tracking usually OFF (privacy)
  - Uses 'outbound' stream
- **Marketing Server**: For campaigns, newsletters, promotions
  - Tracking usually ON (analytics)
  - Uses 'broadcasts' stream

#### 2. Message Streams
- Different streams for different email types
- Helps with analytics and deliverability
- Default streams: 'outbound' (transactional), 'broadcasts' (marketing)

#### 3. Naming Convention
- Servers: `{postmark_id}-transactional`, `{postmark_id}-marketing`
- Example: `AIA001-transactional`, `AIA001-marketing`

## Complete Postmark API Reference

### Authentication
```
Account Token: X-Postmark-Account-Token (manage servers, domains)
Server Token: X-Postmark-Server-Token (send emails)
```

### 1. Email Sending APIs

#### Send Single Email
```http
POST https://api.postmarkapp.com/email
Headers: 
  X-Postmark-Server-Token: {SERVER_TOKEN}
  Content-Type: application/json

Body:
{
  "From": "sender@domain.com",
  "To": "recipient@example.com",
  "Cc": "cc@example.com",
  "Bcc": "bcc@example.com",
  "Subject": "Email Subject",
  "Tag": "invoice",
  "HtmlBody": "<html>...</html>",
  "TextBody": "Plain text version",
  "ReplyTo": "reply@domain.com",
  "Headers": [
    {"Name": "X-Custom", "Value": "Header"}
  ],
  "TrackOpens": true,
  "TrackLinks": "HtmlAndText",
  "MessageStream": "outbound",
  "Metadata": {
    "tenant_id": "123",
    "campaign_id": "456"
  },
  "Attachments": [
    {
      "Name": "file.pdf",
      "Content": "base64_encoded_content",
      "ContentType": "application/pdf"
    }
  ]
}

Response:
{
  "To": "recipient@example.com",
  "SubmittedAt": "2024-01-01T12:00:00Z",
  "MessageID": "message-id",
  "ErrorCode": 0,
  "Message": "OK"
}
```

#### Send Batch Emails (up to 500)
```http
POST https://api.postmarkapp.com/email/batch
Headers: 
  X-Postmark-Server-Token: {SERVER_TOKEN}

Body:
[
  {
    "From": "sender@domain.com",
    "To": "recipient1@example.com",
    "Subject": "Subject 1",
    "HtmlBody": "<html>...</html>"
  },
  {
    "From": "sender@domain.com",
    "To": "recipient2@example.com",
    "Subject": "Subject 2",
    "HtmlBody": "<html>...</html>"
  }
]

Response:
[
  {
    "ErrorCode": 0,
    "Message": "OK",
    "MessageID": "msg-1",
    "SubmittedAt": "2024-01-01T12:00:00Z",
    "To": "recipient1@example.com"
  },
  {
    "ErrorCode": 0,
    "Message": "OK",
    "MessageID": "msg-2",
    "SubmittedAt": "2024-01-01T12:00:01Z",
    "To": "recipient2@example.com"
  }
]
```

#### Send with Template
```http
POST https://api.postmarkapp.com/email/withTemplate
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Body:
{
  "TemplateId": 123456,
  "TemplateAlias": "welcome-email",
  "TemplateModel": {
    "user_name": "John Doe",
    "company_name": "Acme Corp",
    "action_url": "https://example.com/activate"
  },
  "From": "sender@domain.com",
  "To": "recipient@example.com",
  "Tag": "welcome",
  "MessageStream": "outbound"
}
```

### 2. Template Management

#### Create Template
```http
POST https://api.postmarkapp.com/templates
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Body:
{
  "Name": "Welcome Email",
  "Alias": "welcome-email",
  "Subject": "Welcome {{user_name}}!",
  "HtmlBody": "<html>Hello {{user_name}}</html>",
  "TextBody": "Hello {{user_name}}",
  "TemplateType": "Standard",
  "LayoutTemplate": null
}
```

#### List Templates
```http
GET https://api.postmarkapp.com/templates?count=100&offset=0
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Response:
{
  "TotalCount": 25,
  "Templates": [
    {
      "TemplateId": 123456,
      "Name": "Welcome Email",
      "Alias": "welcome-email",
      "Active": true,
      "TemplateType": "Standard",
      "AssociatedServerId": 789
    }
  ]
}
```

### 3. Server Management

#### Create Server
```http
POST https://api.postmarkapp.com/servers
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}

Body:
{
  "Name": "AIA001-transactional",
  "Color": "blue",
  "SmtpApiActivated": true,
  "RawEmailEnabled": false,
  "DeliveryType": "Live",
  "InboundHookUrl": null,
  "BounceHookUrl": "https://app.domain.com/webhooks/bounce",
  "OpenHookUrl": null,
  "PostFirstOpenOnly": true,
  "TrackOpens": false,
  "TrackLinks": "None",
  "IncludeBounceContentInHook": false,
  "EnableSmtpApiErrorHooks": true
}

Response:
{
  "ID": 123456,
  "Name": "AIA001-transactional",
  "ApiTokens": ["server-token-xxx"],
  "ServerLink": "https://postmarkapp.com/servers/123456/streams",
  "Color": "blue"
}
```

#### List Servers
```http
GET https://api.postmarkapp.com/servers?count=100&offset=0
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}

Response:
{
  "TotalCount": 10,
  "Servers": [
    {
      "ID": 123456,
      "Name": "AIA001-transactional",
      "ApiTokens": ["token-xxx"],
      "Color": "blue",
      "SmtpApiActivated": true,
      "RawEmailEnabled": false,
      "DeliveryType": "Live",
      "InboundAddress": "xxx@inbound.postmarkapp.com",
      "InboundHookUrl": null,
      "BounceHookUrl": "https://app.domain.com/webhooks/bounce",
      "OpenHookUrl": null,
      "PostFirstOpenOnly": true,
      "TrackOpens": false,
      "TrackLinks": "None"
    }
  ]
}
```

### 4. Message Streams

#### Create Message Stream
```http
POST https://api.postmarkapp.com/message-streams
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Body:
{
  "ID": "marketing",
  "Name": "Marketing Emails",
  "Description": "Stream for marketing campaigns",
  "MessageStreamType": "Broadcasts",
  "SubscriptionManagementConfiguration": {
    "UnsubscribeHandlingType": "Postmark"
  }
}

Types:
- Transactional (default 'outbound')
- Broadcasts (marketing)
- Inbound (incoming mail)
```

#### List Message Streams
```http
GET https://api.postmarkapp.com/message-streams
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Response:
{
  "MessageStreams": [
    {
      "ID": "outbound",
      "ServerID": 123456,
      "Name": "Transactional Stream",
      "Description": "Default transactional stream",
      "MessageStreamType": "Transactional",
      "CreatedAt": "2024-01-01T00:00:00Z",
      "ArchivedAt": null
    },
    {
      "ID": "marketing",
      "ServerID": 123456,
      "Name": "Marketing Emails",
      "Description": "Stream for marketing campaigns",
      "MessageStreamType": "Broadcasts",
      "CreatedAt": "2024-01-01T00:00:00Z",
      "ArchivedAt": null
    }
  ]
}
```

### 5. Bounce & Suppression Management

#### Get Bounces
```http
GET https://api.postmarkapp.com/bounces?count=100&offset=0&type=HardBounce&messagestream=outbound
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Response:
{
  "TotalCount": 5,
  "Bounces": [
    {
      "ID": 123,
      "Type": "HardBounce",
      "MessageID": "message-id",
      "TypeCode": 1,
      "Details": "smtp;550 5.1.1 User unknown",
      "Email": "bounced@example.com",
      "From": "sender@domain.com",
      "BouncedAt": "2024-01-01T12:00:00Z",
      "DumpAvailable": true,
      "Inactive": true,
      "CanActivate": true,
      "Subject": "Original subject"
    }
  ]
}
```

#### Add to Suppression List
```http
POST https://api.postmarkapp.com/message-streams/{stream}/suppressions
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Body:
{
  "Suppressions": [
    {
      "EmailAddress": "unsubscribed@example.com"
    }
  ]
}
```

### 6. Statistics & Analytics

#### Get Outbound Overview
```http
GET https://api.postmarkapp.com/stats/outbound?fromdate=2024-01-01&todate=2024-01-31&messagestream=outbound
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Response:
{
  "Sent": 10000,
  "Bounced": 50,
  "SMTPApiErrors": 5,
  "BounceRate": 0.5,
  "SpamComplaints": 2,
  "SpamComplaintsRate": 0.02,
  "Opens": 5000,
  "UniqueOpens": 3000,
  "Tracked": 8000,
  "WithClientRecorded": 7000,
  "WithPlatformRecorded": 6000,
  "WithReadTimeRecorded": 4000
}
```

#### Get Sent Counts
```http
GET https://api.postmarkapp.com/stats/outbound/sends?fromdate=2024-01-01&todate=2024-01-31&messagestream=outbound
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Response:
{
  "Days": [
    {
      "Date": "2024-01-01",
      "Sent": 500
    },
    {
      "Date": "2024-01-02", 
      "Sent": 450
    }
  ],
  "Sent": 10000
}
```

### 7. Webhooks

#### Configure Webhooks
```http
POST https://api.postmarkapp.com/webhooks
Headers:
  X-Postmark-Server-Token: {SERVER_TOKEN}

Body:
{
  "Url": "https://app.domain.com/webhooks/postmark",
  "MessageStream": "outbound",
  "HttpAuth": {
    "Username": "webhook_user",
    "Password": "secure_password"
  },
  "HttpHeaders": [
    {
      "Name": "X-Custom-Header",
      "Value": "CustomValue"
    }
  ],
  "Triggers": {
    "Open": {
      "Enabled": true,
      "PostFirstOpenOnly": true
    },
    "Click": {
      "Enabled": true
    },
    "Delivery": {
      "Enabled": true
    },
    "Bounce": {
      "Enabled": true,
      "IncludeContent": false
    },
    "SpamComplaint": {
      "Enabled": true,
      "IncludeContent": false
    },
    "SubscriptionChange": {
      "Enabled": true
    }
  }
}
```

#### Webhook Payloads

##### Delivery Event
```json
{
  "RecordType": "Delivery",
  "ServerID": 123456,
  "MessageStream": "outbound",
  "MessageID": "message-id",
  "Recipient": "recipient@example.com",
  "Tag": "invoice",
  "DeliveredAt": "2024-01-01T12:00:00Z",
  "Details": "Message delivered successfully",
  "Metadata": {
    "tenant_id": "123",
    "campaign_id": "456"
  }
}
```

##### Open Event
```json
{
  "RecordType": "Open",
  "MessageStream": "marketing",
  "FirstOpen": true,
  "MessageID": "message-id",
  "Recipient": "recipient@example.com",
  "ReceivedAt": "2024-01-01T12:00:00Z",
  "Tag": "newsletter",
  "Client": {
    "Name": "Chrome",
    "Company": "Google",
    "Family": "Chrome"
  },
  "OS": {
    "Name": "Windows",
    "Company": "Microsoft",
    "Family": "Windows"
  },
  "Platform": "Desktop",
  "UserAgent": "Mozilla/5.0...",
  "Geo": {
    "CountryISOCode": "US",
    "Country": "United States",
    "RegionISOCode": "CA",
    "Region": "California",
    "City": "San Francisco"
  }
}
```

##### Click Event
```json
{
  "RecordType": "Click",
  "MessageStream": "marketing",
  "ClickLocation": "HTML",
  "MessageID": "message-id",
  "Recipient": "recipient@example.com",
  "ReceivedAt": "2024-01-01T12:00:00Z",
  "Tag": "newsletter",
  "Link": "https://clicked-link.com/page",
  "OriginalLink": "https://clicked-link.com/page?utm_source=email",
  "Client": {
    "Name": "Chrome",
    "Company": "Google",
    "Family": "Chrome"
  },
  "OS": {
    "Name": "Windows",
    "Company": "Microsoft",
    "Family": "Windows"
  },
  "Platform": "Desktop"
}
```

##### Bounce Event
```json
{
  "RecordType": "Bounce",
  "MessageStream": "outbound",
  "ID": 123456,
  "Type": "HardBounce",
  "TypeCode": 1,
  "Name": "Hard bounce",
  "MessageID": "message-id",
  "Tag": "invoice",
  "Description": "The email address does not exist",
  "Details": "smtp;550 5.1.1 User unknown",
  "Email": "bounced@example.com",
  "From": "sender@domain.com",
  "BouncedAt": "2024-01-01T12:00:00Z",
  "Metadata": {
    "tenant_id": "123"
  }
}
```

##### Spam Complaint Event
```json
{
  "RecordType": "SpamComplaint",
  "MessageStream": "marketing",
  "ID": 123456,
  "Type": "SpamComplaint",
  "MessageID": "message-id",
  "Tag": "newsletter",
  "Email": "complainer@example.com",
  "From": "sender@domain.com",
  "BouncedAt": "2024-01-01T12:00:00Z",
  "Metadata": {
    "tenant_id": "123"
  }
}
```

##### Subscription Change Event
```json
{
  "RecordType": "SubscriptionChange",
  "MessageStream": "marketing",
  "MessageID": "message-id",
  "Recipient": "recipient@example.com",
  "Origin": "Recipient",
  "SuppressSending": true,
  "ChangedAt": "2024-01-01T12:00:00Z",
  "Tag": "newsletter",
  "Metadata": {
    "tenant_id": "123"
  }
}
```

### 8. Domain Management

#### Add Domain
```http
POST https://api.postmarkapp.com/domains
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}

Body:
{
  "Name": "tenant-domain.com",
  "ReturnPathDomain": "pm-bounces.tenant-domain.com"
}

Response:
{
  "Name": "tenant-domain.com",
  "ID": 123456,
  "SPFVerified": false,
  "DKIMVerified": false,
  "WeakDKIM": false,
  "ReturnPathDomainVerified": false,
  "DKIMHost": "20240101000000._domainkey.tenant-domain.com",
  "DKIMTextValue": "k=rsa; p=MIG...",
  "DKIMPendingHost": "20240101000000._domainkey.tenant-domain.com",
  "DKIMPendingTextValue": "k=rsa; p=MIG...",
  "DKIMRevokedHost": "",
  "DKIMRevokedTextValue": "",
  "DKIMUpdateStatus": "Pending",
  "ReturnPathDomain": "pm-bounces.tenant-domain.com",
  "ReturnPathDomainCNAMEValue": "pm.mtasv.net",
  "SafeToRemoveRevokedKeyFromDNS": false,
  "DKIMVerificationError": "",
  "ReturnPathDomainVerificationError": "",
  "SPFHost": "tenant-domain.com",
  "SPFTextValue": "v=spf1 a mx include:spf.mtasv.net ~all"
}
```

#### Verify Domain
```http
PUT https://api.postmarkapp.com/domains/{domainID}/verifyDkim
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}

PUT https://api.postmarkapp.com/domains/{domainID}/verifyReturnPath
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}

PUT https://api.postmarkapp.com/domains/{domainID}/verifySpf
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}
```

#### Get Domain
```http
GET https://api.postmarkapp.com/domains/{domainID}
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}

Response: (same structure as Add Domain response)
```

### 9. Sender Signatures

#### Create Sender Signature
```http
POST https://api.postmarkapp.com/senders
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}

Body:
{
  "FromEmail": "noreply@tenant-domain.com",
  "Name": "Tenant Name",
  "ReplyToEmail": "support@tenant-domain.com",
  "ConfirmationPersonalNote": "Please confirm this email address"
}

Response:
{
  "Domain": "tenant-domain.com",
  "EmailAddress": "noreply@tenant-domain.com",
  "Name": "Tenant Name",
  "ReplyToEmailAddress": "support@tenant-domain.com",
  "Confirmed": false,
  "ID": 123456
}
```

#### List Sender Signatures
```http
GET https://api.postmarkapp.com/senders?count=100&offset=0
Headers:
  X-Postmark-Account-Token: {ACCOUNT_TOKEN}

Response:
{
  "TotalCount": 5,
  "SenderSignatures": [
    {
      "Domain": "tenant-domain.com",
      "EmailAddress": "noreply@tenant-domain.com",
      "Name": "Tenant Name",
      "ReplyToEmailAddress": "support@tenant-domain.com",
      "Confirmed": true,
      "ID": 123456
    }
  ]
}
```

## Rate Limits & Best Practices

### Rate Limits
- Account API: 500 requests/hour
- Server API: 12,000 requests/hour
- Batch sending: 500 messages per request
- Payload size: 50MB max per request

### Best Practices
1. **Use Batch API** for sending multiple emails
2. **Use Templates** for consistent formatting
3. **Separate Servers** for transactional vs marketing
4. **Use Message Streams** to categorize email types
5. **Enable Webhooks** for real-time tracking
6. **Store Metadata** for linking emails to your system
7. **Handle Bounces** properly to maintain reputation
8. **Verify Domains** for better deliverability

## Error Codes

Common error codes:
- 0: Success
- 10: Bad or missing API token
- 300: Invalid email address
- 400: Sender signature not found
- 401: Sender signature not confirmed
- 402: Invalid JSON
- 403: Incompatible JSON
- 405: Not allowed to send
- 406: Inactive recipient
- 407: Bounce not found
- 408: Template not found
- 409: No inbound domain
- 410: No such server
- 411: Sandbox server cannot send
- 413: Request size exceeded

## Implementation Strategy for ContactGate

Based on pandaly-super-admin, here's how we should implement:

1. **Database Setup**
   - Add postmark_id to tenants
   - Create postmark_settings table
   - Store server tokens encrypted

2. **Per-Tenant Configuration**
   - Generate unique postmark_id (ABC001 format)
   - Create 2 servers (transactional + marketing)
   - Configure message streams
   - Set up domain verification

3. **Email Module Features**
   - Campaign management (uses marketing server)
   - Transactional emails (uses transactional server)
   - Template management
   - Contact segmentation
   - Analytics dashboard
   - Bounce/complaint handling
   - Unsubscribe management

4. **Integration Points**
   - Webhook endpoints for tracking
   - Event logging to contacts.events
   - Update contact engagement scores
   - Handle bounces/complaints
   - Manage suppressions

This approach gives each tenant isolated email infrastructure while maintaining centralized management.