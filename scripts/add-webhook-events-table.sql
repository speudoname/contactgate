-- Create table for storing Postmark webhook events
CREATE TABLE IF NOT EXISTS contacts.email_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- bounce, delivery, open, click, spam_complaint, subscription_change, inbound
  server_id INTEGER, -- Postmark server ID
  message_id TEXT, -- Postmark message ID
  recipient_email TEXT,
  event_data JSONB NOT NULL, -- Full event details
  raw_payload JSONB NOT NULL, -- Raw webhook payload for debugging
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for querying by tenant and time
  INDEX idx_webhook_tenant_time (tenant_id, processed_at DESC),
  -- Index for finding events by message
  INDEX idx_webhook_message (message_id),
  -- Index for finding events by recipient
  INDEX idx_webhook_recipient (tenant_id, recipient_email)
);

-- Add email status fields to contacts table if not exists
DO $$ 
BEGIN
  -- Check if columns exist before adding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'contacts' 
    AND table_name = 'contacts' 
    AND column_name = 'email_status'
  ) THEN
    ALTER TABLE contacts.contacts
    ADD COLUMN email_status TEXT DEFAULT 'active' CHECK (email_status IN ('active', 'bounced', 'unsubscribed', 'complained')),
    ADD COLUMN email_status_updated_at TIMESTAMPTZ,
    ADD COLUMN email_status_reason TEXT;
  END IF;
END $$;

-- Grant permissions
GRANT ALL PRIVILEGES ON contacts.email_webhook_events TO service_role;
GRANT SELECT ON contacts.email_webhook_events TO authenticated;

-- Enable RLS
ALTER TABLE contacts.email_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role has full access" ON contacts.email_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read their tenant events" ON contacts.email_webhook_events
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);