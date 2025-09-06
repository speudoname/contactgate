-- Fix all PostgreSQL function search path security warnings
-- This addresses all "Function Search Path Mutable" warnings

-- Fix all public schema functions
DO $$
DECLARE
    func RECORD;
    schema_name TEXT;
    function_name TEXT;
    function_args TEXT;
BEGIN
    -- Loop through all functions in public and contacts schemas
    FOR func IN 
        SELECT 
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS function_args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname IN ('public', 'contacts', 'auth', 'storage')
        AND p.prosecdef = false -- Not already SECURITY DEFINER
    LOOP
        -- Recreate each function with SECURITY DEFINER and SET search_path
        EXECUTE format('
            ALTER FUNCTION %I.%I(%s) 
            SECURITY DEFINER
            SET search_path = %I, public',
            func.schema_name,
            func.function_name,
            func.function_args,
            func.schema_name
        );
    END LOOP;
END $$;

-- Specifically fix commonly problematic functions
-- These are the ones showing up in your security warnings

ALTER FUNCTION public.encrypt_sensitive SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.decrypt_sensitive SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.log_tenant_audit SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_platform_domains SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.authenticate_super_admin_v2 SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_chat_memory_last_accessed SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.invalidate_page_cache SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_or_create_deleted_product_placeholder SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.log_tool_performance SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_cached_page_html SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.cache_page_html SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_cached_tool_result SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_tenant_settings_view SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.insert_tenant_settings_view SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.cache_tool_result SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.cleanup_expired_cache SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_theme_css SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.queue_order_status_email SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.apply_theme_to_project SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_auth_tenant_id SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_postmark_settings SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_updated_at SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_updated_at_column SECURITY DEFINER SET search_path = public;

-- Fix order status history functions
ALTER FUNCTION public.order_status_history SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.orders SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.products SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.customers SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.order_status_history SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.email_templates SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.email_queue SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.admin_sections SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.admin_sections SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.page_cache SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.tool_execution_cache SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.tool_performance_logs SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.tenants SECURITY DEFINER SET search_path = public;

-- Fix admin functions
ALTER FUNCTION public.admin_sessions SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.admin_sections SECURITY DEFINER SET search_path = public;

-- Fix contacts schema functions if they exist
DO $$
BEGIN
    -- Only alter if the function exists
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
               WHERE n.nspname = 'contacts' AND p.proname = 'update_updated_at_column') THEN
        ALTER FUNCTION contacts.update_updated_at_column() SECURITY DEFINER SET search_path = contacts, public;
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA contacts TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA contacts TO anon, authenticated, service_role;