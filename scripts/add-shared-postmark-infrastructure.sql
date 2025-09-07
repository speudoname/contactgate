-- Add Shared Postmark Infrastructure for ContactGate
-- This migration adds support for shared vs dedicated email servers

-- 1. Create shared server configuration table (platform-wide)
CREATE TABLE IF NOT EXISTS contacts.shared_postmark_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transactional Server (no tracking for better deliverability)
  transactional_server_token TEXT NOT NULL,
  transactional_server_id INTEGER,
  transactional_stream_id TEXT DEFAULT 'transactional-shared',
  
  -- Marketing Server (full tracking enabled)
  marketing_server_token TEXT NOT NULL,
  marketing_server_id INTEGER,
  marketing_stream_id TEXT DEFAULT 'marketing-shared',
  
  -- Default sender configuration
  default_from_email TEXT DEFAULT 'share@share.komunate.com',
  default_from_name TEXT DEFAULT 'Komunate Platform',
  default_reply_to TEXT DEFAULT 'noreply@komunate.com',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE contacts.shared_postmark_config IS 'Platform-wide shared Postmark server configuration for tenants using shared mode';

-- 2. Update postmark_settings for dual mode support
ALTER TABLE contacts.postmark_settings 
ADD COLUMN IF NOT EXISTS server_mode TEXT DEFAULT 'shared' 
  CHECK (server_mode IN ('shared', 'dedicated')),
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS activation_status TEXT DEFAULT 'pending'
  CHECK (activation_status IN ('pending', 'checking', 'activating', 'active', 'failed')),
ADD COLUMN IF NOT EXISTS activation_error TEXT,
ADD COLUMN IF NOT EXISTS custom_from_email TEXT,
ADD COLUMN IF NOT EXISTS custom_from_name TEXT,
ADD COLUMN IF NOT EXISTS custom_reply_to TEXT;

-- Add comments
COMMENT ON COLUMN contacts.postmark_settings.server_mode IS 'Whether tenant uses shared or dedicated Postmark servers';
COMMENT ON COLUMN contacts.postmark_settings.activation_status IS 'Status of dedicated server activation process';
COMMENT ON COLUMN contacts.postmark_settings.custom_from_email IS 'Custom sender email (used in both shared and dedicated modes)';

-- 3. Add email tier to tenants table for pricing
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS email_tier TEXT DEFAULT 'free' 
  CHECK (email_tier IN ('free', 'starter', 'pro', 'enterprise')),
ADD COLUMN IF NOT EXISTS email_activated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_monthly_limit INTEGER DEFAULT 1000;

-- Add comments
COMMENT ON COLUMN public.tenants.email_tier IS 'Email service pricing tier';
COMMENT ON COLUMN public.tenants.email_monthly_limit IS 'Monthly email send limit based on tier';

-- 4. Create email signatures table for sender management
CREATE TABLE IF NOT EXISTS contacts.email_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Signature details
  signature_id INTEGER, -- Postmark signature ID
  from_email TEXT NOT NULL,
  from_name TEXT,
  reply_to_email TEXT,
  
  -- Verification status
  domain_verified BOOLEAN DEFAULT FALSE,
  spf_verified BOOLEAN DEFAULT FALSE,
  dkim_verified BOOLEAN DEFAULT FALSE,
  return_path_verified BOOLEAN DEFAULT FALSE,
  
  -- DNS records (stored for reference)
  spf_record JSONB,
  dkim_record JSONB,
  return_path_record JSONB,
  
  -- Metadata
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  
  UNIQUE(tenant_id, from_email)
);

-- 5. Update email_sends to track server mode
ALTER TABLE contacts.email_sends 
ADD COLUMN IF NOT EXISTS server_mode TEXT DEFAULT 'shared'
  CHECK (server_mode IN ('shared', 'dedicated'));

-- 6. Create tier limits configuration
CREATE TABLE IF NOT EXISTS contacts.email_tier_limits (
  tier TEXT PRIMARY KEY CHECK (tier IN ('free', 'starter', 'pro', 'enterprise')),
  monthly_limit INTEGER NOT NULL,
  daily_limit INTEGER NOT NULL,
  can_use_dedicated BOOLEAN DEFAULT FALSE,
  can_use_custom_domain BOOLEAN DEFAULT FALSE,
  support_level TEXT DEFAULT 'community',
  price_monthly DECIMAL(10,2) DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb
);

-- Add index for email_signatures
CREATE INDEX IF NOT EXISTS idx_email_signatures_tenant ON contacts.email_signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_signatures_default ON contacts.email_signatures(tenant_id, is_default) WHERE is_default = TRUE;

-- Insert default tier configurations
INSERT INTO contacts.email_tier_limits (tier, monthly_limit, daily_limit, can_use_dedicated, can_use_custom_domain, support_level, price_monthly, features) VALUES
  ('free', 1000, 50, FALSE, FALSE, 'community', 0, '["Shared servers", "Basic templates", "Standard support"]'::jsonb),
  ('starter', 10000, 500, TRUE, FALSE, 'email', 29, '["Dedicated servers", "Custom sender", "Email support", "Basic analytics"]'::jsonb),
  ('pro', 50000, 2000, TRUE, TRUE, 'priority', 99, '["Dedicated servers", "Custom domain", "Priority support", "Advanced analytics", "A/B testing"]'::jsonb),
  ('enterprise', -1, -1, TRUE, TRUE, 'dedicated', 299, '["Unlimited sends", "Multiple domains", "Dedicated support", "Custom integration", "SLA"]'::jsonb)
ON CONFLICT (tier) DO UPDATE SET
  monthly_limit = EXCLUDED.monthly_limit,
  daily_limit = EXCLUDED.daily_limit,
  features = EXCLUDED.features;

-- 7. Create function to check email limits
CREATE OR REPLACE FUNCTION contacts.check_email_limit(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = contacts, public
AS $$
DECLARE
  v_tier TEXT;
  v_monthly_limit INTEGER;
  v_daily_limit INTEGER;
  v_monthly_sent INTEGER;
  v_daily_sent INTEGER;
BEGIN
  -- Get tenant's tier
  SELECT email_tier INTO v_tier
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Get tier limits
  SELECT monthly_limit, daily_limit INTO v_monthly_limit, v_daily_limit
  FROM contacts.email_tier_limits
  WHERE tier = v_tier;
  
  -- Check for unlimited (-1 means unlimited)
  IF v_monthly_limit = -1 THEN
    RETURN TRUE;
  END IF;
  
  -- Count monthly sends
  SELECT COUNT(*) INTO v_monthly_sent
  FROM contacts.email_sends
  WHERE tenant_id = p_tenant_id
    AND created_at >= date_trunc('month', CURRENT_DATE);
  
  -- Count daily sends
  SELECT COUNT(*) INTO v_daily_sent
  FROM contacts.email_sends
  WHERE tenant_id = p_tenant_id
    AND created_at >= CURRENT_DATE;
  
  -- Check limits
  IF v_monthly_sent >= v_monthly_limit OR v_daily_sent >= v_daily_limit THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 8. Create function to get email configuration
CREATE OR REPLACE FUNCTION contacts.get_email_config(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = contacts, public
AS $$
DECLARE
  v_settings RECORD;
  v_shared_config RECORD;
  v_result JSONB;
BEGIN
  -- Get tenant settings
  SELECT * INTO v_settings
  FROM contacts.postmark_settings
  WHERE tenant_id = p_tenant_id;
  
  -- If no settings, create default
  IF v_settings IS NULL THEN
    INSERT INTO contacts.postmark_settings (tenant_id, server_mode)
    VALUES (p_tenant_id, 'shared')
    RETURNING * INTO v_settings;
  END IF;
  
  -- Build configuration based on mode
  IF v_settings.server_mode = 'shared' THEN
    -- Get shared configuration
    SELECT * INTO v_shared_config
    FROM contacts.shared_postmark_config
    LIMIT 1;
    
    v_result := jsonb_build_object(
      'mode', 'shared',
      'transactional_server_token', v_shared_config.transactional_server_token,
      'transactional_stream_id', v_shared_config.transactional_stream_id,
      'marketing_server_token', v_shared_config.marketing_server_token,
      'marketing_stream_id', v_shared_config.marketing_stream_id,
      'from_email', COALESCE(v_settings.custom_from_email, v_shared_config.default_from_email),
      'from_name', COALESCE(v_settings.custom_from_name, v_shared_config.default_from_name),
      'reply_to', COALESCE(v_settings.custom_reply_to, v_shared_config.default_reply_to)
    );
  ELSE
    -- Use dedicated configuration
    v_result := jsonb_build_object(
      'mode', 'dedicated',
      'transactional_server_token', v_settings.transactional_server_token,
      'transactional_stream_id', v_settings.transactional_stream_id,
      'marketing_server_token', v_settings.marketing_server_token,
      'marketing_stream_id', v_settings.marketing_stream_id,
      'from_email', v_settings.custom_from_email,
      'from_name', v_settings.custom_from_name,
      'reply_to', v_settings.custom_reply_to
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- 9. Add RLS policies for new tables
ALTER TABLE contacts.shared_postmark_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.email_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.email_tier_limits ENABLE ROW LEVEL SECURITY;

-- Shared config is read-only for all authenticated users
CREATE POLICY "Shared config readable by all" ON contacts.shared_postmark_config
  FOR SELECT USING (true);

-- Email signatures are tenant-specific
CREATE POLICY "Tenants can manage their signatures" ON contacts.email_signatures
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Tier limits are readable by all
CREATE POLICY "Tier limits readable by all" ON contacts.email_tier_limits
  FOR SELECT USING (true);

-- 10. Insert default shared configuration (UPDATE WITH YOUR ACTUAL TOKENS)
-- Note: This should be done manually with real Postmark server tokens
DO $$
BEGIN
  -- Check if shared config exists
  IF NOT EXISTS (SELECT 1 FROM contacts.shared_postmark_config) THEN
    INSERT INTO contacts.shared_postmark_config (
      transactional_server_token,
      transactional_server_id,
      marketing_server_token,
      marketing_server_id
    ) VALUES (
      'PLACEHOLDER_TRANSACTIONAL_TOKEN', -- Replace with actual token
      NULL, -- Will be set when we know the server ID
      'PLACEHOLDER_MARKETING_TOKEN', -- Replace with actual token
      NULL -- Will be set when we know the server ID
    );
    
    RAISE NOTICE 'Shared Postmark configuration created. Please update with actual server tokens!';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Shared Postmark infrastructure created successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update shared_postmark_config with actual Postmark server tokens';
  RAISE NOTICE '2. Create the shared servers in Postmark dashboard';
  RAISE NOTICE '3. Update the server IDs in shared_postmark_config';
END $$;