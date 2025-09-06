-- Comprehensive fix for ALL function security warnings
-- This handles all 23 functions showing in the security advisor

DO $$
DECLARE
    func RECORD;
    fixed_count INT := 0;
    error_count INT := 0;
BEGIN
    -- List of all functions showing warnings
    FOR func IN 
        SELECT DISTINCT 
            unnest(ARRAY[
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
                'update_updated_at_column'
            ]) AS function_name
    LOOP
        BEGIN
            -- Check if function exists
            IF EXISTS (
                SELECT 1 FROM pg_proc p 
                JOIN pg_namespace n ON p.pronamespace = n.oid 
                WHERE n.nspname = 'public' AND p.proname = func.function_name
            ) THEN
                -- Try to fix it
                EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public, pg_catalog', func.function_name);
                fixed_count := fixed_count + 1;
                RAISE NOTICE 'Fixed: public.%', func.function_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Try with parameters if no-param version fails
            BEGIN
                -- Some functions might have parameters
                IF func.function_name = 'user_has_tenant_access' THEN
                    EXECUTE 'ALTER FUNCTION public.user_has_tenant_access(UUID) SET search_path = public, pg_catalog';
                    fixed_count := fixed_count + 1;
                    RAISE NOTICE 'Fixed: public.% (with params)', func.function_name;
                ELSIF func.function_name = 'apply_theme_to_project' THEN
                    EXECUTE 'ALTER FUNCTION public.apply_theme_to_project(UUID, UUID) SET search_path = public, pg_catalog';
                    fixed_count := fixed_count + 1;
                    RAISE NOTICE 'Fixed: public.% (with params)', func.function_name;
                ELSE
                    error_count := error_count + 1;
                    RAISE NOTICE 'Could not fix: % - %', func.function_name, SQLERRM;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                error_count := error_count + 1;
                RAISE NOTICE 'Could not fix: % - %', func.function_name, SQLERRM;
            END;
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

-- Also fix any trigger functions
DO $$
BEGIN
    -- Common trigger functions
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_catalog;
        RAISE NOTICE 'Fixed trigger function: update_updated_at_column';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_modified_column') THEN
        ALTER FUNCTION public.update_modified_column() SET search_path = public, pg_catalog;
        RAISE NOTICE 'Fixed trigger function: update_modified_column';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not fix trigger functions: %', SQLERRM;
END $$;

-- Show final status
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    CASE 
        WHEN p.proconfig::text LIKE '%search_path%' THEN '✅ Has search_path'
        ELSE '⚠️ Missing search_path'
    END as status,
    p.prosecdef as is_security_definer
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
    'update_updated_at', 'update_updated_at_column'
)
ORDER BY status DESC, function_name;