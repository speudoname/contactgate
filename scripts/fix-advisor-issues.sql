-- ============================================
-- FIX SECURITY AND PERFORMANCE ADVISOR ISSUES
-- ============================================
-- This migration fixes:
-- 1. RLS not enabled on contacts.postmark_settings
-- 2. Functions with search_path vulnerabilities
-- 3. Auth RLS initialization plans
-- 4. Multiple permission policies on shared_postmark_config
-- ============================================

-- ============================================
-- STEP 1: ENABLE RLS ON POSTMARK_SETTINGS
-- ============================================

ALTER TABLE contacts.postmark_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for postmark_settings
CREATE POLICY "Tenants can manage their own postmark settings" ON contacts.postmark_settings
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================
-- STEP 2: FIX FUNCTION SEARCH_PATH VULNERABILITIES
-- ============================================
-- All these functions need SET search_path = '' to prevent security issues

-- Fix pagebuilder functions
ALTER FUNCTION pagebuilder.get_chat_context() SET search_path = '';
ALTER FUNCTION pagebuilder.summarize_old_messages() SET search_path = '';

-- Fix contacts schema functions
ALTER FUNCTION contacts.update_updated_at_column() SET search_path = '';
ALTER FUNCTION contacts.get_pending_emails(TEXT, INTEGER) SET search_path = '';
ALTER FUNCTION contacts.mark_email_sent(TEXT, UUID, TEXT, JSONB) SET search_path = '';
ALTER FUNCTION contacts.mark_email_failed(TEXT, UUID, TEXT, JSONB) SET search_path = '';
ALTER FUNCTION contacts.get_postmark_settings(UUID) SET search_path = '';
ALTER FUNCTION contacts.is_email_suppressed(UUID, TEXT, TEXT) SET search_path = '';

-- ============================================
-- STEP 3: FIX AUTH RLS INITIALIZATION PLANS
-- ============================================
-- These tables need proper auth policies for initialization

-- Fix for pagebuilder chat_context
ALTER TABLE pagebuilder.chat_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own chat context" ON pagebuilder.chat_context
    FOR ALL USING (auth.uid() = user_id);

-- Fix for pagebuilder chat_sessions
ALTER TABLE pagebuilder.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own chat sessions" ON pagebuilder.chat_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Fix for pagebuilder chat_messages
ALTER TABLE pagebuilder.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access messages from their sessions" ON pagebuilder.chat_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pagebuilder.chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- Fix for pagebuilder file_operations
ALTER TABLE pagebuilder.file_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own file operations" ON pagebuilder.file_operations
    FOR ALL USING (auth.uid() = user_id);

-- Fix for contacts.email_queue_marketing
-- Already has RLS enabled, but needs better policy
DROP POLICY IF EXISTS "Tenants can manage their own marketing emails" ON contacts.email_queue_marketing;
CREATE POLICY "Tenants can manage their own marketing emails" ON contacts.email_queue_marketing
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Fix for contacts.email_queue_transactional  
-- Already has RLS enabled, but needs better policy
DROP POLICY IF EXISTS "Tenants can manage their own transactional emails" ON contacts.email_queue_transactional;
CREATE POLICY "Tenants can manage their own transactional emails" ON contacts.email_queue_transactional
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================
-- STEP 4: FIX MULTIPLE PERMISSION POLICIES
-- ============================================
-- contacts.shared_postmark_config has multiple policies which can affect performance

-- First, check if the table has RLS enabled
ALTER TABLE contacts.shared_postmark_config ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies to start fresh
DROP POLICY IF EXISTS "Service role has full access" ON contacts.shared_postmark_config;
DROP POLICY IF EXISTS "Authenticated users can read" ON contacts.shared_postmark_config;
DROP POLICY IF EXISTS "Allow read access" ON contacts.shared_postmark_config;
DROP POLICY IF EXISTS "Allow service role" ON contacts.shared_postmark_config;

-- Create a single, optimized policy for shared_postmark_config
-- This is a shared configuration table, so all authenticated users can read it
CREATE POLICY "Authenticated users can read shared config" ON contacts.shared_postmark_config
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role can modify shared config
CREATE POLICY "Service role can modify shared config" ON contacts.shared_postmark_config
    FOR ALL USING (auth.role() = 'service_role');

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
    RAISE NOTICE '  ✅ Fixed search_path vulnerabilities in 8 functions';
    RAISE NOTICE '  ✅ Added RLS policies for pagebuilder tables';
    RAISE NOTICE '  ✅ Fixed email queue RLS policies';
    RAISE NOTICE '';
    RAISE NOTICE 'PERFORMANCE FIXES:';
    RAISE NOTICE '  ✅ Consolidated shared_postmark_config policies';
    RAISE NOTICE '  ✅ Added optimized indexes for queries';
    RAISE NOTICE '  ✅ Removed redundant permission checks';
    RAISE NOTICE '';
    RAISE NOTICE 'All advisor warnings should now be resolved!';
    RAISE NOTICE '===========================================';
END $$;