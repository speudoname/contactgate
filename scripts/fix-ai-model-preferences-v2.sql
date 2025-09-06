-- Fix performance warnings for ai_model_preferences (CORRECTED VERSION)
-- Fixes the syntax error in the previous version

-- First check what policies exist
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'ai_model_preferences';

-- Drop existing policies with proper syntax
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    -- Loop through and drop all existing policies on ai_model_preferences
    FOR policy_rec IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'ai_model_preferences'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_model_preferences', policy_rec.policyname);
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping policies: %', SQLERRM;
END $$;

-- Create consolidated, efficient policies
-- One for service role (bypass all checks)
DO $$
BEGIN
    CREATE POLICY "Service role full access" ON public.ai_model_preferences
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Service role policy already exists';
END $$;

-- One consolidated policy for authenticated users
DO $$
BEGIN
    CREATE POLICY "Authenticated users tenant access" ON public.ai_model_preferences
        FOR ALL
        TO authenticated
        USING (
            -- Check if user has access to this tenant
            tenant_id::text = (auth.jwt()->>'tenant_id')::text
            OR
            tenant_id IN (
                SELECT tenant_id 
                FROM public.tenant_users 
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            -- Same check for writes
            tenant_id::text = (auth.jwt()->>'tenant_id')::text
            OR
            tenant_id IN (
                SELECT tenant_id 
                FROM public.tenant_users 
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Authenticated users policy already exists';
END $$;

-- Verify the optimization
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE tablename = 'ai_model_preferences'
GROUP BY tablename;

-- Show success message
DO $$
DECLARE
    policy_count INT;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'ai_model_preferences';
    
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'AI Model Preferences Optimization Done!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Current policy count: %', policy_count;
    RAISE NOTICE 'Target: 2 policies (service role + authenticated)';
    IF policy_count <= 2 THEN
        RAISE NOTICE 'Status: ✅ OPTIMIZED';
    ELSE
        RAISE NOTICE 'Status: ⚠️ Still has % policies', policy_count;
    END IF;
    RAISE NOTICE '=========================================';
END $$;