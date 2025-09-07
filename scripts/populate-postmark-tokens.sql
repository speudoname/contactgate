-- ============================================
-- POPULATE POSTMARK API TOKENS WITH ACTUAL VALUES
-- ============================================
-- Based on actual Postmark servers fetched from API
-- ============================================

-- First, update the shared server configuration
INSERT INTO contacts.shared_postmark_config (server_name, server_token)
VALUES ('defaultsharednumagte', '59cf1ddb-d888-43b8-9d6d-a56879df5bd6')
ON CONFLICT (server_name) 
DO UPDATE SET 
  server_token = '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
  updated_at = NOW();

-- Update all tenants using shared mode to use the shared server token
UPDATE contacts.postmark_settings
SET 
  shared_server_token = '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
  updated_at = NOW()
WHERE server_mode = 'shared';

-- Update specific tenant tokens based on their assigned servers
-- These are examples based on the servers we found

-- For MUS001 (Betlemi10)
UPDATE contacts.postmark_settings
SET 
  dedicated_transactional_token = 'fec0c42d-3701-463c-8f26-71545147be7e',
  dedicated_marketing_token = 'fec0c42d-3701-463c-8f26-71545147be7e',
  updated_at = NOW()
WHERE tenant_id IN (
  SELECT id FROM public.tenants WHERE postmark_id = 'MUS001'
);

-- For AIX001 (aiacademy.ge)
UPDATE contacts.postmark_settings
SET 
  dedicated_transactional_token = '8e9d16a7-bb09-4fc0-8509-de30207de037',
  dedicated_marketing_token = '8e9d16a7-bb09-4fc0-8509-de30207de037',
  updated_at = NOW()
WHERE tenant_id IN (
  SELECT id FROM public.tenants WHERE postmark_id = 'AIX001'
);

-- For Vibenar
UPDATE contacts.postmark_settings
SET 
  dedicated_transactional_token = 'a99437c1-ce0c-4c50-800a-310c7257701a',
  dedicated_marketing_token = 'a99437c1-ce0c-4c50-800a-310c7257701a',
  updated_at = NOW()
WHERE tenant_id IN (
  SELECT id FROM public.tenants WHERE name = 'Vibenar'
);

-- ============================================
-- CREATE FUNCTION TO AUTO-POPULATE TOKENS
-- ============================================
-- This function will be called when assigning servers to tenants

CREATE OR REPLACE FUNCTION contacts.fetch_and_store_postmark_token(
    p_tenant_id UUID,
    p_server_name TEXT,
    p_server_mode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token TEXT;
    v_result JSONB;
BEGIN
    -- Map of known servers to their tokens
    -- In production, this would call Postmark API
    CASE p_server_name
        WHEN 'defaultsharednumagte' THEN v_token := '59cf1ddb-d888-43b8-9d6d-a56879df5bd6';
        WHEN 'Vibenar' THEN v_token := 'a99437c1-ce0c-4c50-800a-310c7257701a';
        WHEN 'nebiswera' THEN v_token := '927c3f49-6643-4b83-a389-f16a99fee642';
        WHEN 'aiacademia' THEN v_token := '5b8616d6-cc97-4f84-a733-34274c997553';
        WHEN 'Videomatik' THEN v_token := '4a4a39f6-ea72-4581-8bfb-9330ccba613c';
        WHEN 'AIX001  acacademy.ge' THEN v_token := '8e9d16a7-bb09-4fc0-8509-de30207de037';
        WHEN 'MUS001 Betlemi10' THEN v_token := 'fec0c42d-3701-463c-8f26-71545147be7e';
        WHEN 'katsman Server' THEN v_token := 'f16cba05-d7e5-4739-8f48-0a7c38efe388';
        ELSE v_token := NULL;
    END CASE;
    
    IF v_token IS NOT NULL THEN
        IF p_server_mode = 'shared' THEN
            UPDATE contacts.postmark_settings
            SET 
                shared_server_token = v_token,
                updated_at = NOW()
            WHERE tenant_id = p_tenant_id;
        ELSE
            -- For dedicated, store in both transactional and marketing
            UPDATE contacts.postmark_settings
            SET 
                dedicated_transactional_token = v_token,
                dedicated_marketing_token = v_token,
                updated_at = NOW()
            WHERE tenant_id = p_tenant_id;
        END IF;
        
        v_result = jsonb_build_object(
            'success', true,
            'token_stored', true,
            'server', p_server_name
        );
    ELSE
        v_result = jsonb_build_object(
            'success', false,
            'error', 'Unknown server name'
        );
    END IF;
    
    RETURN v_result;
END;
$$;

-- ============================================
-- VERIFY TOKEN POPULATION
-- ============================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Count tenants with tokens
    SELECT COUNT(*) INTO v_count
    FROM contacts.postmark_settings
    WHERE shared_server_token IS NOT NULL 
       OR dedicated_transactional_token IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ POSTMARK TOKENS POPULATED!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Tenants with tokens: %', v_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Available Servers:';
    RAISE NOTICE '  • defaultsharednumagte (shared)';
    RAISE NOTICE '  • Vibenar';
    RAISE NOTICE '  • MUS001 Betlemi10';
    RAISE NOTICE '  • AIX001 aiacademy.ge';
    RAISE NOTICE '  • Others as needed';
    RAISE NOTICE '===========================================';
END $$;