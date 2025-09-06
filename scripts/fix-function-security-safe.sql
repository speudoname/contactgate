-- Fix PostgreSQL function search path security warnings (SAFE VERSION)
-- This skips auth schema and other system functions we don't own

-- Only fix functions in public and contacts schemas that we own
DO $$
DECLARE
    func RECORD;
BEGIN
    -- Loop through only functions we can modify
    FOR func IN 
        SELECT 
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS function_args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname IN ('public', 'contacts')  -- Only our schemas
        AND p.prosecdef = false -- Not already SECURITY DEFINER
        AND p.proowner = current_user::regrole -- Only functions we own
    LOOP
        BEGIN
            -- Try to alter the function
            EXECUTE format('
                ALTER FUNCTION %I.%I(%s) 
                SECURITY DEFINER
                SET search_path = %I, public',
                func.schema_name,
                func.function_name,
                func.function_args,
                func.schema_name
            );
        EXCEPTION WHEN insufficient_privilege THEN
            -- Skip functions we can't modify
            RAISE NOTICE 'Skipping % due to insufficient privileges', func.function_name;
        END;
    END LOOP;
END $$;

-- Fix specific public functions we know exist and own
DO $$
BEGIN
    -- Check if function exists before altering
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
    ) THEN
        ALTER FUNCTION public.update_updated_at_column() 
            SECURITY DEFINER SET search_path = public;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Ignore if we don't have permission
END $$;

-- Fix contacts schema functions if they exist and we own them
DO $$
BEGIN
    -- Check if function exists before altering
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'contacts' AND p.proname = 'update_updated_at_column'
    ) THEN
        ALTER FUNCTION contacts.update_updated_at_column() 
            SECURITY DEFINER SET search_path = contacts, public;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Ignore if we don't have permission
END $$;