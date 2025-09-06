-- Identify tables with excessive RLS policies
-- The 160+ warnings are likely from these tables, NOT from ContactGate

-- 1. Find the culprit tables with many policies
WITH policy_counts AS (
    SELECT 
        schemaname,
        tablename,
        COUNT(*) as policy_count
    FROM pg_policies
    GROUP BY schemaname, tablename
)
SELECT 
    schemaname,
    tablename,
    policy_count,
    CASE 
        WHEN policy_count > 50 THEN '🔴 EXCESSIVE - Needs optimization'
        WHEN policy_count > 20 THEN '🟡 HIGH - Consider optimization'
        WHEN policy_count > 10 THEN '🟢 MODERATE - Acceptable'
        ELSE '✅ GOOD'
    END as status
FROM policy_counts
WHERE policy_count > 5
ORDER BY policy_count DESC;

-- 2. Show detailed breakdown of the worst offenders
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename IN (
    SELECT tablename 
    FROM pg_policies 
    GROUP BY schemaname, tablename 
    HAVING COUNT(*) > 20
    LIMIT 5
)
ORDER BY tablename, policyname;

-- 3. Likely suspects (common tables with many policies)
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
    'admin_sections',
    'admin_sessions', 
    'orders',
    'products',
    'customers',
    'pages',
    'page_cache',
    'tool_execution_cache',
    'email_queue',
    'email_templates'
)
GROUP BY tablename
ORDER BY policy_count DESC;

-- 4. Show if these are from PageNumGate or NumGate
SELECT DISTINCT
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename LIKE '%page%' 
   OR tablename LIKE '%admin%'
   OR tablename LIKE '%order%'
   OR tablename LIKE '%product%'
   OR tablename LIKE '%email%'
GROUP BY schemaname, tablename
ORDER BY policy_count DESC;

-- 5. ContactGate should have ZERO or minimal policies
SELECT 
    'ContactGate Tables' as category,
    COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'contacts'
UNION ALL
SELECT 
    'Other Public Tables' as category,
    COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename NOT IN ('contacts', 'tenants', 'users');