-- ============================================
-- FIX SECURITY AND PERFORMANCE ADVISOR ISSUES (V2)
-- ============================================
-- This migration fixes advisor issues in the contacts schema only
-- Handles cases where policies may already exist
-- ============================================

-- ============================================
-- STEP 1: ENABLE RLS ON POSTMARK_SETTINGS
-- ============================================

ALTER TABLE contacts.postmark_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Tenants can manage their own postmark settings" ON contacts.postmark_settings;
CREATE POLICY "Tenants can manage their own postmark settings" ON contacts.postmark_settings
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================
-- STEP 2: FIX FUNCTION SEARCH_PATH VULNERABILITIES
-- ============================================
-- Only fix functions that exist in contacts schema

DO $$
BEGIN
    -- Check and fix contacts.update_updated_at_column if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'contacts'::regnamespace) THEN
        ALTER FUNCTION contacts.update_updated_at_column() SET search_path = '';
    END IF;
    
    -- Check and fix contacts.get_pending_emails if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_pending_emails' AND pronamespace = 'contacts'::regnamespace) THEN
        ALTER FUNCTION contacts.get_pending_emails(TEXT, INTEGER) SET search_path = '';
    END IF;
    
    -- Check and fix contacts.mark_email_sent if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_email_sent' AND pronamespace = 'contacts'::regnamespace) THEN
        ALTER FUNCTION contacts.mark_email_sent(TEXT, UUID, TEXT, JSONB) SET search_path = '';
    END IF;
    
    -- Check and fix contacts.mark_email_failed if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_email_failed' AND pronamespace = 'contacts'::regnamespace) THEN
        ALTER FUNCTION contacts.mark_email_failed(TEXT, UUID, TEXT, JSONB) SET search_path = '';
    END IF;
    
    -- Check and fix contacts.get_postmark_settings if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_postmark_settings' AND pronamespace = 'contacts'::regnamespace) THEN
        ALTER FUNCTION contacts.get_postmark_settings(UUID) SET search_path = '';
    END IF;
    
    -- Check and fix contacts.is_email_suppressed if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_email_suppressed' AND pronamespace = 'contacts'::regnamespace) THEN
        ALTER FUNCTION contacts.is_email_suppressed(UUID, TEXT, TEXT) SET search_path = '';
    END IF;
END $$;

-- ============================================
-- STEP 3: FIX EMAIL QUEUE RLS POLICIES
-- ============================================

-- Fix for contacts.email_queue_marketing
-- Drop existing policy first, then create new one
DROP POLICY IF EXISTS "Tenants can manage their own marketing emails" ON contacts.email_queue_marketing;
CREATE POLICY "Tenants can manage their own marketing emails" ON contacts.email_queue_marketing
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Fix for contacts.email_queue_transactional  
-- Drop existing policy first, then create new one
DROP POLICY IF EXISTS "Tenants can manage their own transactional emails" ON contacts.email_queue_transactional;
CREATE POLICY "Tenants can manage their own transactional emails" ON contacts.email_queue_transactional
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================
-- STEP 4: FIX MULTIPLE PERMISSION POLICIES
-- ============================================
-- contacts.shared_postmark_config has multiple policies which can affect performance

-- First, check if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'contacts' 
               AND table_name = 'shared_postmark_config') THEN
        
        -- Enable RLS
        ALTER TABLE contacts.shared_postmark_config ENABLE ROW LEVEL SECURITY;
        
        -- Remove ALL existing policies to start fresh
        DROP POLICY IF EXISTS "Service role has full access" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Authenticated users can read" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Allow read access" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Allow service role" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Authenticated users can read shared config" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Service role can modify shared config" ON contacts.shared_postmark_config;
        
        -- Create single, optimized policies
        CREATE POLICY "Authenticated users can read shared config" ON contacts.shared_postmark_config
            FOR SELECT USING (auth.role() = 'authenticated');
        
        -- Only service role can modify shared config
        CREATE POLICY "Service role can modify shared config" ON contacts.shared_postmark_config
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================
-- STEP 5: CREATE INDEXES FOR BETTER PERFORMANCE
-- ============================================
-- Add indexes to improve query performance on frequently accessed columns

-- Index for tenant-based queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_postmark_settings_tenant ON contacts.postmark_settings(tenant_id);

-- Index for email queue processing (already created in previous migration, but ensure they exist)
CREATE INDEX IF NOT EXISTS idx_email_queue_trans_processing ON contacts.email_queue_transactional(status, scheduled_for) 
    WHERE status IN ('pending', 'processing');
    
CREATE INDEX IF NOT EXISTS idx_email_queue_mark_processing ON contacts.email_queue_marketing(status, scheduled_for) 
    WHERE status IN ('pending', 'processing');

-- ============================================
-- MIGRATION SUMMARY
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ SECURITY & PERFORMANCE FIXES COMPLETE!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'SECURITY FIXES:';
    RAISE NOTICE '  ✅ Enabled RLS on contacts.postmark_settings';
    RAISE NOTICE '  ✅ Fixed search_path vulnerabilities in contacts functions';
    RAISE NOTICE '  ✅ Fixed email queue RLS policies';
    RAISE NOTICE '';
    RAISE NOTICE 'PERFORMANCE FIXES:';
    RAISE NOTICE '  ✅ Consolidated shared_postmark_config policies (if table exists)';
    RAISE NOTICE '  ✅ Added optimized indexes for queries';
    RAISE NOTICE '  ✅ Removed redundant permission checks';
    RAISE NOTICE '';
    RAISE NOTICE 'All advisor warnings in contacts schema should now be resolved!';
    RAISE NOTICE '===========================================';
END $$;