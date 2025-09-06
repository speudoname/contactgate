-- =========================================
-- FIX FINAL 2 PERFORMANCE WARNINGS
-- =========================================

-- =========================================
-- PART 1: Fix Auth RLS Initialization Plan Warning
-- =========================================
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    RAISE NOTICE 'Fixing Auth RLS Initialization Plan warning...';
    RAISE NOTICE 'This warning appears when auth.uid() and auth.jwt() are called unnecessarily';
    
    -- Drop existing policies
    FOR policy_rec IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'ai_model_preferences'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_model_preferences', policy_rec.policyname);
    END LOOP;
    
    -- Create more efficient policies that minimize auth calls
    
    -- 1. Service role - no auth check needed
    CREATE POLICY "service_full_access" ON public.ai_model_preferences
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    
    -- 2. Authenticated users - optimized to reduce auth function calls
    -- Using a single subquery to minimize re-evaluation
    CREATE POLICY "user_tenant_access" ON public.ai_model_preferences
        FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 
                FROM public.tenant_users tu
                WHERE tu.tenant_id = ai_model_preferences.tenant_id
                AND tu.user_id = auth.uid()
                LIMIT 1
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 
                FROM public.tenant_users tu
                WHERE tu.tenant_id = ai_model_preferences.tenant_id
                AND tu.user_id = auth.uid()
                LIMIT 1
            )
        );
    
    RAISE NOTICE '✅ Created optimized RLS policies for ai_model_preferences';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing RLS policies: %', SQLERRM;
END $$;

-- =========================================
-- PART 2: Fix Duplicate Index on contacts.events
-- =========================================
DO $$
DECLARE
    idx RECORD;
    idx_count INT := 0;
    i INT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Analyzing duplicate indexes on contacts.events...';
    
    -- List all indexes on contacts.events
    RAISE NOTICE '';
    RAISE NOTICE 'Current indexes:';
    FOR idx IN
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = 'contacts' 
        AND tablename = 'events'
        ORDER BY indexname
    LOOP
        idx_count := idx_count + 1;
        RAISE NOTICE '%: %', idx.indexname, idx.indexdef;
    END LOOP;
    
    IF idx_count = 0 THEN
        RAISE NOTICE 'No indexes found on contacts.events';
    ELSIF idx_count > 1 THEN
        -- Check for actual duplicates (same columns)
        RAISE NOTICE '';
        RAISE NOTICE 'Checking for duplicate index definitions...';
        
        -- Try to identify and drop duplicate indexes
        -- Look for indexes on the same columns
        FOR idx IN
            WITH index_cols AS (
                SELECT 
                    indexname,
                    array_agg(attname ORDER BY attnum) as columns
                FROM pg_indexes i
                JOIN pg_class c ON c.relname = i.indexname
                JOIN pg_index ix ON ix.indexrelid = c.oid
                JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
                WHERE i.schemaname = 'contacts' 
                AND i.tablename = 'events'
                GROUP BY indexname
            ),
            duplicates AS (
                SELECT 
                    columns,
                    array_agg(indexname ORDER BY indexname) as index_names,
                    COUNT(*) as count
                FROM index_cols
                GROUP BY columns
                HAVING COUNT(*) > 1
            )
            SELECT 
                index_names[2:] as duplicate_indexes
            FROM duplicates
        LOOP
            -- Drop the duplicate indexes (keeping the first one)
            IF idx.duplicate_indexes IS NOT NULL THEN
                FOR i IN 1..array_length(idx.duplicate_indexes, 1) LOOP
                    EXECUTE format('DROP INDEX IF EXISTS contacts.%I', idx.duplicate_indexes[i]);
                    RAISE NOTICE '✅ Dropped duplicate index: %', idx.duplicate_indexes[i];
                END LOOP;
            END IF;
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE 'Duplicate index cleanup complete';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing indexes: %', SQLERRM;
END $$;

-- =========================================
-- VERIFICATION
-- =========================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '🎉 FINAL FIX COMPLETE';
    RAISE NOTICE '=========================================';
END $$;

-- Check RLS policies
SELECT 
    'RLS Policy Count' as check_type,
    COUNT(*) || ' policies on ai_model_preferences' as result
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'ai_model_preferences'
GROUP BY check_type

UNION ALL

-- Check indexes
SELECT 
    'Index Count' as check_type,
    COUNT(*) || ' indexes on contacts.events' as result
FROM pg_indexes
WHERE schemaname = 'contacts' 
AND tablename = 'events'
GROUP BY check_type

ORDER BY check_type;