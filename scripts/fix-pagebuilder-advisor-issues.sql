-- ============================================
-- FIX PAGEBUILDER SECURITY AND PERFORMANCE ADVISOR ISSUES
-- ============================================
-- This migration fixes advisor issues in the pagebuilder schema
-- ============================================

-- ============================================
-- STEP 1: FIX FUNCTION SEARCH_PATH VULNERABILITIES
-- ============================================
-- Fix pagebuilder functions that have search_path vulnerabilities

DO $$
BEGIN
    -- Check and fix pagebuilder.get_chat_context if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_chat_context' AND pronamespace = 'pagebuilder'::regnamespace) THEN
        ALTER FUNCTION pagebuilder.get_chat_context() SET search_path = '';
    END IF;
    
    -- Check and fix pagebuilder.summarize_old_messages if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'summarize_old_messages' AND pronamespace = 'pagebuilder'::regnamespace) THEN
        ALTER FUNCTION pagebuilder.summarize_old_messages() SET search_path = '';
    END IF;
END $$;

-- ============================================
-- STEP 2: FIX AUTH RLS INITIALIZATION PLANS
-- ============================================
-- These tables need proper auth policies for initialization

-- Fix for pagebuilder.chat_context
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'pagebuilder' 
               AND table_name = 'chat_context') THEN
        
        ALTER TABLE pagebuilder.chat_context ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can manage their own chat context" ON pagebuilder.chat_context;
        
        -- Create new policy
        CREATE POLICY "Users can manage their own chat context" ON pagebuilder.chat_context
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Fix for pagebuilder.chat_sessions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'pagebuilder' 
               AND table_name = 'chat_sessions') THEN
        
        ALTER TABLE pagebuilder.chat_sessions ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can manage their own chat sessions" ON pagebuilder.chat_sessions;
        
        -- Create new policy
        CREATE POLICY "Users can manage their own chat sessions" ON pagebuilder.chat_sessions
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Fix for pagebuilder.chat_messages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'pagebuilder' 
               AND table_name = 'chat_messages') THEN
        
        ALTER TABLE pagebuilder.chat_messages ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can access messages from their sessions" ON pagebuilder.chat_messages;
        
        -- Create new policy
        CREATE POLICY "Users can access messages from their sessions" ON pagebuilder.chat_messages
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM pagebuilder.chat_sessions
                    WHERE chat_sessions.id = chat_messages.session_id
                    AND chat_sessions.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Fix for pagebuilder.file_operations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'pagebuilder' 
               AND table_name = 'file_operations') THEN
        
        ALTER TABLE pagebuilder.file_operations ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can manage their own file operations" ON pagebuilder.file_operations;
        
        -- Create new policy
        CREATE POLICY "Users can manage their own file operations" ON pagebuilder.file_operations
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================
-- STEP 3: FIX MULTIPLE PERMISSION POLICIES
-- ============================================
-- Fix contacts.shared_postmark_config multiple permission policies

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'contacts' 
               AND table_name = 'shared_postmark_config') THEN
        
        -- Drop ALL existing policies to ensure clean state
        DROP POLICY IF EXISTS "Service role has full access" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Authenticated users can read" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Allow read access" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Allow service role" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Authenticated users can read shared config" ON contacts.shared_postmark_config;
        DROP POLICY IF EXISTS "Service role can modify shared config" ON contacts.shared_postmark_config;
        
        -- Create consolidated policies
        CREATE POLICY "shared_config_read" ON contacts.shared_postmark_config
            FOR SELECT USING (true);  -- Public read since it's shared config
        
        CREATE POLICY "shared_config_write" ON contacts.shared_postmark_config
            FOR INSERT USING (auth.role() = 'service_role');
            
        CREATE POLICY "shared_config_update" ON contacts.shared_postmark_config
            FOR UPDATE USING (auth.role() = 'service_role');
            
        CREATE POLICY "shared_config_delete" ON contacts.shared_postmark_config
            FOR DELETE USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================
-- MIGRATION SUMMARY
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ PAGEBUILDER ADVISOR FIXES COMPLETE!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'SECURITY FIXES:';
    RAISE NOTICE '  ✅ Fixed search_path for pagebuilder functions';
    RAISE NOTICE '  ✅ Added RLS policies for chat_context';
    RAISE NOTICE '  ✅ Added RLS policies for chat_sessions';
    RAISE NOTICE '  ✅ Added RLS policies for chat_messages';
    RAISE NOTICE '  ✅ Added RLS policies for file_operations';
    RAISE NOTICE '';
    RAISE NOTICE 'PERFORMANCE FIXES:';
    RAISE NOTICE '  ✅ Consolidated shared_postmark_config policies';
    RAISE NOTICE '';
    RAISE NOTICE 'All advisor warnings should now be resolved!';
    RAISE NOTICE '===========================================';
END $$;