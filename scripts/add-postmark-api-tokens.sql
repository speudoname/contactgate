-- ============================================
-- ADD POSTMARK API TOKEN COLUMNS
-- ============================================
-- This migration adds API token storage for Postmark servers
-- Each server has its own API token that needs to be stored
-- ============================================

-- Add API token columns to postmark_settings
ALTER TABLE contacts.postmark_settings 
ADD COLUMN IF NOT EXISTS shared_server_token TEXT,
ADD COLUMN IF NOT EXISTS dedicated_transactional_token TEXT,
ADD COLUMN IF NOT EXISTS dedicated_marketing_token TEXT;

-- Add comments for clarity
COMMENT ON COLUMN contacts.postmark_settings.shared_server_token IS 'API token for the shared Postmark server';
COMMENT ON COLUMN contacts.postmark_settings.dedicated_transactional_token IS 'API token for the dedicated transactional server';
COMMENT ON COLUMN contacts.postmark_settings.dedicated_marketing_token IS 'API token for the dedicated marketing/broadcast server';

-- ============================================
-- CREATE FUNCTION TO FETCH AND STORE API TOKENS
-- ============================================
-- This function will be called when assigning servers to tenants
-- It fetches the API token from Postmark and stores it

CREATE OR REPLACE FUNCTION contacts.update_postmark_tokens(
    p_tenant_id UUID,
    p_server_mode TEXT,
    p_postmark_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- For now, we'll use placeholder tokens
    -- In production, this would call Postmark API to get actual tokens
    
    IF p_server_mode = 'shared' THEN
        -- Update shared server token
        UPDATE contacts.postmark_settings
        SET 
            shared_server_token = 'PLACEHOLDER_SHARED_TOKEN', -- Replace with actual
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id;
        
        v_result = jsonb_build_object(
            'success', true,
            'mode', 'shared',
            'message', 'Shared server token updated'
        );
    ELSIF p_server_mode = 'dedicated' AND p_postmark_id IS NOT NULL THEN
        -- Update dedicated server tokens
        UPDATE contacts.postmark_settings
        SET 
            dedicated_transactional_token = 'PLACEHOLDER_TRANS_TOKEN_' || p_postmark_id,
            dedicated_marketing_token = 'PLACEHOLDER_MARKET_TOKEN_' || p_postmark_id,
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id;
        
        v_result = jsonb_build_object(
            'success', true,
            'mode', 'dedicated',
            'message', 'Dedicated server tokens updated'
        );
    ELSE
        v_result = jsonb_build_object(
            'success', false,
            'message', 'Invalid server mode or missing postmark_id'
        );
    END IF;
    
    RETURN v_result;
END;
$$;

-- ============================================
-- POPULATE EXISTING TENANTS WITH API TOKENS
-- ============================================
-- First, let's see what tenants we have and their current settings

DO $$
DECLARE
    v_tenant RECORD;
    v_postmark_id TEXT;
BEGIN
    -- Loop through all tenants with postmark settings
    FOR v_tenant IN 
        SELECT 
            ps.tenant_id,
            ps.server_mode,
            t.postmark_id
        FROM contacts.postmark_settings ps
        LEFT JOIN public.tenants t ON t.id = ps.tenant_id
    LOOP
        -- Get the postmark_id from tenants table
        v_postmark_id := v_tenant.postmark_id;
        
        -- Update tokens based on server mode
        IF v_tenant.server_mode = 'shared' THEN
            UPDATE contacts.postmark_settings
            SET 
                shared_server_token = '8b973481-ba10-41a0-bafb-9b3cb96e79f4', -- Default shared server token
                updated_at = NOW()
            WHERE tenant_id = v_tenant.tenant_id;
            
            RAISE NOTICE 'Updated shared token for tenant %', v_tenant.tenant_id;
            
        ELSIF v_tenant.server_mode = 'dedicated' AND v_postmark_id IS NOT NULL THEN
            -- For dedicated servers, we need the actual tokens
            -- These would come from Postmark API in production
            UPDATE contacts.postmark_settings
            SET 
                dedicated_transactional_token = 'NEEDS_ACTUAL_TOKEN_' || v_postmark_id || '_trans',
                dedicated_marketing_token = 'NEEDS_ACTUAL_TOKEN_' || v_postmark_id || '_market',
                updated_at = NOW()
            WHERE tenant_id = v_tenant.tenant_id;
            
            RAISE NOTICE 'Updated dedicated tokens for tenant % with postmark_id %', v_tenant.tenant_id, v_postmark_id;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- ADD SHARED POSTMARK CONFIG TABLE
-- ============================================
-- This stores the default shared server configuration

CREATE TABLE IF NOT EXISTS contacts.shared_postmark_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_name TEXT NOT NULL DEFAULT 'komunate-shared',
    server_token TEXT NOT NULL,
    transactional_stream TEXT DEFAULT 'outbound',
    marketing_stream TEXT DEFAULT 'broadcast',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default shared server config
INSERT INTO contacts.shared_postmark_config (server_name, server_token)
VALUES ('komunate-shared', '8b973481-ba10-41a0-bafb-9b3cb96e79f4')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE contacts.shared_postmark_config ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policy (already handled in previous migration)
DROP POLICY IF EXISTS "Authenticated users can read shared config" ON contacts.shared_postmark_config;
DROP POLICY IF EXISTS "Service role can modify shared config" ON contacts.shared_postmark_config;

CREATE POLICY "Anyone can read shared config" ON contacts.shared_postmark_config
    FOR SELECT USING (true);

CREATE POLICY "Service role manages shared config" ON contacts.shared_postmark_config
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- MIGRATION SUMMARY
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ POSTMARK API TOKENS MIGRATION COMPLETE!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Changes:';
    RAISE NOTICE '  ✅ Added API token columns to postmark_settings';
    RAISE NOTICE '  ✅ Created update_postmark_tokens function';
    RAISE NOTICE '  ✅ Created shared_postmark_config table';
    RAISE NOTICE '  ✅ Populated existing tenants with placeholder tokens';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Replace placeholder tokens with actual Postmark API tokens!';
    RAISE NOTICE '===========================================';
END $$;