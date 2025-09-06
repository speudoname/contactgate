-- =========================================
-- MASTER FIX FOR ALL SECURITY & PERFORMANCE WARNINGS
-- ContactGate + NumGate Projects
-- =========================================
-- This script fixes:
-- 1. All 23 function security warnings
-- 2. AI model preferences performance warnings (4)
-- 3. NumGate function security warnings (3)
-- =========================================

-- =========================================
-- PART 1: Fix ALL Function Security Warnings
-- =========================================
DO $$
DECLARE
    func_rec RECORD;
    fixed_count INT := 0;
    error_count INT := 0;
    function_list TEXT[] := ARRAY[
        'encrypt_sensitive',
        'decrypt_sensitive', 
        'log_tenant_audit',
        'get_platform_domains',
        'authenticate_super_admin_v2',
        'update_chat_memory_last_accessed',
        'invalidate_page_cache',
        'get_or_create_deleted_product_placeholder',
        'log_tool_performance',
        'get_cached_page_html',
        'cache_page_html',
        'get_cached_tool_result',
        'update_tenant_settings_view',
        'insert_tenant_settings_view',
        'cache_tool_result',
        'cleanup_expired_cache',
        'get_theme_css',
        'queue_order_status_email',
        'apply_theme_to_project',
        'get_auth_tenant_id',
        'get_postmark_settings',
        'update_updated_at',
        'update_updated_at_column',
        'get_auth_user_id',
        'user_is_admin',
        'get_auth_user_role',
        'user_has_tenant_access'
    ];
    func_name TEXT;
BEGIN
    RAISE NOTICE 'Starting function security fixes...';
    
    -- Process each function
    FOREACH func_name IN ARRAY function_list
    LOOP
        BEGIN
            -- Check if function exists and get its signature
            FOR func_rec IN
                SELECT 
                    p.proname,
                    pg_get_function_identity_arguments(p.oid) as args,
                    p.proargtypes::oid[]::regtype[]::text[] as arg_types
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' 
                AND p.proname = func_name
            LOOP
                -- Fix the function with its proper signature
                IF func_rec.args = '' THEN
                    -- No parameters
                    EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public, pg_catalog', func_rec.proname);
                    fixed_count := fixed_count + 1;
                    RAISE NOTICE '✅ Fixed: public.%()', func_rec.proname;
                ELSE
                    -- Has parameters
                    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_catalog', 
                                   func_rec.proname, func_rec.args);
                    fixed_count := fixed_count + 1;
                    RAISE NOTICE '✅ Fixed: public.%(%)', func_rec.proname, func_rec.args;
                END IF;
            END LOOP;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE '❌ Could not fix: % - %', func_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Function Security Fix Summary';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Successfully fixed: % functions', fixed_count;
    RAISE NOTICE 'Errors/Skipped: % functions', error_count;
    RAISE NOTICE '=========================================';
END $$;

-- =========================================
-- PART 2: Fix AI Model Preferences Performance
-- =========================================
DO $$
DECLARE
    policy_rec RECORD;
    policy_count INT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Starting AI model preferences optimization...';
    
    -- Check if table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_model_preferences'
    ) THEN
        RAISE NOTICE 'Table ai_model_preferences does not exist, skipping...';
    ELSE
        -- Drop all existing policies
        FOR policy_rec IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'ai_model_preferences'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_model_preferences', policy_rec.policyname);
            RAISE NOTICE 'Dropped policy: %', policy_rec.policyname;
        END LOOP;
        
        -- Create optimized policies
        -- 1. Service role policy
        CREATE POLICY "service_role_all" ON public.ai_model_preferences
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Created service role policy';
        
        -- 2. Authenticated users policy (consolidated)
        CREATE POLICY "authenticated_tenant" ON public.ai_model_preferences
            FOR ALL
            TO authenticated
            USING (
                tenant_id::text = COALESCE((auth.jwt()->>'tenant_id')::text, '')
                OR
                EXISTS (
                    SELECT 1 FROM public.tenant_users 
                    WHERE tenant_users.tenant_id = ai_model_preferences.tenant_id
                    AND tenant_users.user_id = auth.uid()
                )
            )
            WITH CHECK (
                tenant_id::text = COALESCE((auth.jwt()->>'tenant_id')::text, '')
                OR
                EXISTS (
                    SELECT 1 FROM public.tenant_users 
                    WHERE tenant_users.tenant_id = ai_model_preferences.tenant_id
                    AND tenant_users.user_id = auth.uid()
                )
            );
        RAISE NOTICE '✅ Created authenticated users policy';
        
        -- Count final policies
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies
        WHERE schemaname = 'public' 
        AND tablename = 'ai_model_preferences';
        
        RAISE NOTICE '';
        RAISE NOTICE '=========================================';
        RAISE NOTICE 'AI Model Preferences Optimization Done!';
        RAISE NOTICE '=========================================';
        RAISE NOTICE 'Final policy count: % (target: 2)', policy_count;
        IF policy_count = 2 THEN
            RAISE NOTICE 'Status: ✅ OPTIMIZED';
        ELSE
            RAISE NOTICE 'Status: ⚠️ Check policies manually';
        END IF;
        RAISE NOTICE '=========================================';
    END IF;
END $$;

-- =========================================
-- PART 3: Final Verification
-- =========================================
DO $$
DECLARE
    func_count INT;
    func_with_path INT;
    policy_count INT;
BEGIN
    -- Count functions and their search_path status
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN p.proconfig::text LIKE '%search_path%' THEN 1 END)
    INTO func_count, func_with_path
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'encrypt_sensitive', 'decrypt_sensitive', 'log_tenant_audit',
        'get_platform_domains', 'authenticate_super_admin_v2',
        'update_chat_memory_last_accessed', 'invalidate_page_cache',
        'get_or_create_deleted_product_placeholder', 'log_tool_performance',
        'get_cached_page_html', 'cache_page_html', 'get_cached_tool_result',
        'update_tenant_settings_view', 'insert_tenant_settings_view',
        'cache_tool_result', 'cleanup_expired_cache', 'get_theme_css',
        'queue_order_status_email', 'apply_theme_to_project',
        'get_auth_tenant_id', 'get_postmark_settings',
        'update_updated_at', 'update_updated_at_column',
        'get_auth_user_id', 'user_is_admin', 'get_auth_user_role',
        'user_has_tenant_access'
    );
    
    -- Count AI model preferences policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename = 'ai_model_preferences';
    
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '🎉 MASTER FIX COMPLETE SUMMARY 🎉';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Functions found: %', func_count;
    RAISE NOTICE 'Functions with search_path: %', func_with_path;
    RAISE NOTICE 'AI model policies: %', policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Expected results:';
    RAISE NOTICE '- All functions should have search_path';
    RAISE NOTICE '- AI model should have 2 policies';
    RAISE NOTICE '=========================================';
END $$;

-- Show detailed status for verification
SELECT 
    'Function Status' as category,
    p.proname as item_name,
    CASE 
        WHEN p.proconfig::text LIKE '%search_path%' THEN '✅ Fixed'
        ELSE '❌ Needs Fix'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'encrypt_sensitive', 'decrypt_sensitive', 'log_tenant_audit',
    'get_platform_domains', 'authenticate_super_admin_v2',
    'update_chat_memory_last_accessed', 'invalidate_page_cache',
    'get_or_create_deleted_product_placeholder', 'log_tool_performance',
    'get_cached_page_html', 'cache_page_html', 'get_cached_tool_result',
    'update_tenant_settings_view', 'insert_tenant_settings_view',
    'cache_tool_result', 'cleanup_expired_cache', 'get_theme_css',
    'queue_order_status_email', 'apply_theme_to_project',
    'get_auth_tenant_id', 'get_postmark_settings',
    'update_updated_at', 'update_updated_at_column',
    'get_auth_user_id', 'user_is_admin', 'get_auth_user_role',
    'user_has_tenant_access'
)
UNION ALL
SELECT 
    'AI Preferences Policy' as category,
    policyname as item_name,
    '✅ Active' as status
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'ai_model_preferences'
ORDER BY category, item_name;