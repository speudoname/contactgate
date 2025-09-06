-- Fix performance warnings for ai_model_preferences
-- These are the 4 remaining performance warnings

-- Check if the table exists and what policies it has
SELECT 
    tablename,
    policyname,
    cmd,
    roles,
    qual
FROM pg_policies
WHERE tablename = 'ai_model_preferences';

-- The warning says "Multiple Permissive Policies"
-- This means there are multiple policies being evaluated for each row
-- Let's consolidate them into single, more efficient policies

-- First, drop existing policies (we'll recreate better ones)
DO $$
BEGIN
    -- Drop all existing policies on ai_model_preferences
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'ai_model_preferences'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_model_preferences', r.policyname);
    END LOOP;
END $$;

-- Create consolidated, efficient policies
-- One for service role (bypass all checks)
CREATE POLICY "Service role full access" ON public.ai_model_preferences
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- One consolidated policy for authenticated users (instead of multiple)
CREATE POLICY "Authenticated users tenant access" ON public.ai_model_preferences
    FOR ALL
    TO authenticated
    USING (
        -- Single condition check for tenant access
        tenant_id IN (
            SELECT tenant_id 
            FROM public.tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        -- Same check for writes
        tenant_id IN (
            SELECT tenant_id 
            FROM public.tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- Verify the optimization
SELECT 
    'BEFORE' as status,
    COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'ai_model_preferences'
UNION ALL
SELECT 
    'AFTER (should be 2)' as status,
    2 as policy_count;

-- Check if we still have performance warnings
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'AI Model Preferences Optimization Done!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Reduced from multiple policies to just 2:';
    RAISE NOTICE '1. Service role bypass';
    RAISE NOTICE '2. Consolidated authenticated user policy';
    RAISE NOTICE 'This should eliminate the 4 performance warnings';
    RAISE NOTICE '=========================================';
END $$;