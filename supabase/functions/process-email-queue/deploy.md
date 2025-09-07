# Email Queue Processor - Deployment Guide

## Prerequisites
1. Supabase CLI installed
2. Access to Supabase project
3. Postmark API tokens

## Step 1: Set Environment Variables in Supabase

Run these commands to set the required secrets:

```bash
# Set the shared Postmark API token (required)
supabase secrets set SHARED_POSTMARK_API_TOKEN=your-shared-postmark-token

# Optional: Set dedicated tokens for specific tenants
# These are stored in the database per tenant
```

## Step 2: Deploy the Edge Function

```bash
# Navigate to the project root
cd /Users/apple/komunate/contactgate

# Deploy the function
supabase functions deploy process-email-queue

# Or deploy with specific project ref
supabase functions deploy process-email-queue --project-ref your-project-ref
```

## Step 3: Test the Function

```bash
# Test locally
supabase functions serve process-email-queue

# Test deployed function
curl -i --location --request POST \
  'https://your-project-ref.supabase.co/functions/v1/process-email-queue' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

## Step 4: Set up UptimeMonitor (or Cron)

### Option A: Using UptimeMonitor.io

1. Sign up at https://uptimemonitor.io
2. Create a new monitor:
   - URL: `https://your-project-ref.supabase.co/functions/v1/process-email-queue`
   - Method: POST
   - Headers: 
     - `Authorization: Bearer YOUR_ANON_KEY`
     - `Content-Type: application/json`
   - Interval: 30 seconds

### Option B: Using Supabase Cron (pg_cron)

Create a cron job in Supabase SQL Editor:

```sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to run every 30 seconds
-- Note: pg_cron minimum interval is 1 minute, so we'll use 1 minute
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Option C: Using External Cron Service

Use services like:
- EasyCron.com
- Cron-job.org
- AWS Lambda with EventBridge

## Step 5: Monitor Function Logs

```bash
# View function logs
supabase functions logs process-email-queue

# Follow logs in real-time
supabase functions logs process-email-queue --follow
```

## Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| SHARED_POSTMARK_API_TOKEN | Postmark API token for shared server | Yes |
| SUPABASE_URL | Automatically set by Supabase | Yes |
| SUPABASE_SERVICE_ROLE_KEY | Automatically set by Supabase | Yes |

## Database Requirements

The following tables must exist:
- `contacts.email_queue_transactional`
- `contacts.email_queue_marketing`
- `contacts.postmark_settings`

## Security Notes

1. The function uses service role key to bypass RLS
2. Each tenant's emails are processed with their specific settings
3. Failed emails are retried with exponential backoff
4. Maximum 3 retry attempts per email

## Monitoring

The function returns:
```json
{
  "success": true,
  "transactional": {
    "processed": 10,
    "failed": 2,
    "errors": ["Error messages if any"]
  },
  "marketing": {
    "processed": 50,
    "failed": 0,
    "errors": []
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Troubleshooting

1. **No emails being sent**: Check if SHARED_POSTMARK_API_TOKEN is set
2. **Authentication errors**: Verify the Postmark API token is valid
3. **Emails stuck in queue**: Check function logs for errors
4. **Rate limiting**: Adjust the batch size in the function (currently 50)