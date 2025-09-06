-- Investigate RLS Policies in the database
-- This will show us what tables have RLS and how many policies

-- 1. Count all RLS policies by table
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count,
    policyname
FROM pg_policies
GROUP BY schemaname, tablename, policyname
ORDER BY COUNT(*) DESC, schemaname, tablename;

-- 2. Show which tables have RLS enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE rowsecurity = true
ORDER BY schemaname, tablename;

-- 3. Count total policies per table
SELECT 
    schemaname,
    tablename,
    COUNT(*) as total_policies
FROM pg_policies
GROUP BY schemaname, tablename
ORDER BY COUNT(*) DESC;

-- 4. Show ContactGate-specific tables and their RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'contacts'
   OR (schemaname = 'public' AND tablename IN ('contacts', 'tenants', 'users'))
ORDER BY schemaname, tablename;

-- 5. List all policies for contacts schema tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as policy_condition
FROM pg_policies
WHERE schemaname = 'contacts'
ORDER BY tablename, policyname;

-- 6. Identify tables with excessive policies (more than 10)
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
GROUP BY schemaname, tablename
HAVING COUNT(*) > 10
ORDER BY COUNT(*) DESC;

-- 7. Show all public schema policies (these are likely the problem)
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY COUNT(*) DESC
LIMIT 20;