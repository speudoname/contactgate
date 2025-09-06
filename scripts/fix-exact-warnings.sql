-- =========================================
-- FIX EXACT WARNINGS FROM SUPABASE
-- 3 Security + 5 Performance Warnings
-- =========================================

-- =========================================
-- PART 1: Fix 3 Security Warnings
-- =========================================
DO $$
BEGIN
    RAISE NOTICE 'Fixing 3 security warnings...';
    
    -- 1. Fix get_auth_tenant_id
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'get_auth_tenant_id'
    ) THEN
        ALTER FUNCTION public.get_auth_tenant_id() 
            SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: public.get_auth_tenant_id()';
    ELSE
        RAISE NOTICE '⚠️ Function not found: get_auth_tenant_id';
    END IF;

    -- 2. Fix get_auth_user_id
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'get_auth_user_id'
    ) THEN
        ALTER FUNCTION public.get_auth_user_id() 
            SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: public.get_auth_user_id()';
    ELSE
        RAISE NOTICE '⚠️ Function not found: get_auth_user_id';
    END IF;

    -- 3. Fix user_is_admin
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'user_is_admin'
    ) THEN
        ALTER FUNCTION public.user_is_admin() 
            SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: public.user_is_admin()';
    ELSE
        RAISE NOTICE '⚠️ Function not found: user_is_admin';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Security warnings fixed!';
    RAISE NOTICE '';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing security warnings: %', SQLERRM;
END $$;

-- =========================================
-- PART 2: Fix 4 AI Model Preferences Performance Warnings
-- =========================================
DO $$
DECLARE
    policy_rec RECORD;
    policy_count INT;
BEGIN
    RAISE NOTICE 'Fixing AI model preferences performance warnings...';
    
    -- Check if table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_model_preferences'
    ) THEN
        RAISE NOTICE '⚠️ Table ai_model_preferences does not exist';
    ELSE
        -- Drop all existing policies to clean up duplicates
        FOR policy_rec IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'ai_model_preferences'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_model_preferences', policy_rec.policyname);
        END LOOP;
        
        RAISE NOTICE 'Dropped all existing policies';
        
        -- Create only 2 optimized policies
        
        -- 1. Service role bypass
        CREATE POLICY "service_bypass" ON public.ai_model_preferences
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
            
        RAISE NOTICE '✅ Created service role policy';
        
        -- 2. Single authenticated users policy
        CREATE POLICY "tenant_access" ON public.ai_model_preferences
            FOR ALL
            TO authenticated
            USING (
                tenant_id IN (
                    SELECT tenant_id FROM public.tenant_users 
                    WHERE user_id = auth.uid()
                )
            )
            WITH CHECK (
                tenant_id IN (
                    SELECT tenant_id FROM public.tenant_users 
                    WHERE user_id = auth.uid()
                )
            );
            
        RAISE NOTICE '✅ Created authenticated users policy';
        
        -- Verify we only have 2 policies now
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies
        WHERE schemaname = 'public' 
        AND tablename = 'ai_model_preferences';
        
        RAISE NOTICE '';
        RAISE NOTICE 'AI model preferences now has % policies (target: 2)', policy_count;
        RAISE NOTICE '';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing AI model preferences: %', SQLERRM;
END $$;

-- =========================================
-- PART 3: Fix Duplicate Index on contacts.events
-- =========================================
DO $$
DECLARE
    idx RECORD;
    duplicate_count INT := 0;
BEGIN
    RAISE NOTICE 'Checking for duplicate indexes on contacts.events...';
    
    -- Find duplicate indexes
    FOR idx IN
        SELECT 
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = 'contacts' 
        AND tablename = 'events'
        ORDER BY indexname
    LOOP
        RAISE NOTICE 'Found index: %', idx.indexname;
    END LOOP;
    
    -- Count indexes on same columns
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT DISTINCT indexdef
        FROM pg_indexes
        WHERE schemaname = 'contacts' 
        AND tablename = 'events'
    ) t;
    
    IF duplicate_count > 1 THEN
        RAISE NOTICE '';
        RAISE NOTICE '⚠️ Found duplicate indexes. Review manually and drop unnecessary ones.';
        RAISE NOTICE 'Use: DROP INDEX IF EXISTS contacts.index_name;';
    ELSE
        RAISE NOTICE '✅ No duplicate indexes found';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error checking indexes: %', SQLERRM;
END $$;

-- =========================================
-- FINAL VERIFICATION
-- =========================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '🎉 FIX COMPLETE - VERIFICATION';
    RAISE NOTICE '=========================================';
END $$;

-- Check security functions
SELECT 
    'Security Check' as check_type,
    p.proname as item,
    CASE 
        WHEN p.proconfig::text LIKE '%search_path%' THEN '✅ Fixed'
        ELSE '❌ Still needs fix'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_auth_tenant_id', 'get_auth_user_id', 'user_is_admin')

UNION ALL

-- Check AI model preferences policies
SELECT 
    'Performance Check' as check_type,
    'ai_model_preferences policies' as item,
    COUNT(*) || ' policies (should be 2)' as status
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'ai_model_preferences'
GROUP BY check_type, item

UNION ALL

-- Check contacts.events indexes
SELECT 
    'Index Check' as check_type,
    'contacts.events indexes' as item,
    COUNT(*) || ' indexes' as status
FROM pg_indexes
WHERE schemaname = 'contacts' 
AND tablename = 'events'
GROUP BY check_type, item

ORDER BY check_type, item;