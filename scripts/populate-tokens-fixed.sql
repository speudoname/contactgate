-- ============================================
-- POPULATE POSTMARK API TOKENS WITH ACTUAL VALUES
-- Fixed version that works with existing table structure
-- ============================================

-- First, add the missing columns to postmark_settings if they don't exist
ALTER TABLE contacts.postmark_settings 
ADD COLUMN IF NOT EXISTS shared_server_token TEXT,
ADD COLUMN IF NOT EXISTS dedicated_transactional_token TEXT,
ADD COLUMN IF NOT EXISTS dedicated_marketing_token TEXT;

-- Update the shared server configuration with the actual token
-- The table already exists with different column names
UPDATE contacts.shared_postmark_config
SET 
  transactional_server_token = '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
  marketing_server_token = '59cf1ddb-d888-43b8-9d6d-a56879df5bd6', -- Same server for both in shared mode
  updated_at = NOW()
WHERE id = (SELECT id FROM contacts.shared_postmark_config LIMIT 1);

-- If no row exists, insert one
INSERT INTO contacts.shared_postmark_config (
  transactional_server_token,
  marketing_server_token,
  transactional_server_id,
  marketing_server_id,
  default_from_email,
  default_from_name
) 
SELECT 
  '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
  '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
  NULL,
  NULL,
  'noreply@komunate.com',
  'Komunate Platform'
WHERE NOT EXISTS (SELECT 1 FROM contacts.shared_postmark_config);

-- Update all tenants using shared mode to use the shared server token
UPDATE contacts.postmark_settings
SET 
  shared_server_token = '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
  updated_at = NOW()
WHERE server_mode = 'shared';

-- Update specific tenant tokens based on their assigned servers
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

-- For all tenants that still don't have tokens, set them to shared mode with default token
UPDATE contacts.postmark_settings
SET 
  server_mode = 'shared',
  shared_server_token = '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
  updated_at = NOW()
WHERE 
  (shared_server_token IS NULL OR shared_server_token = '') 
  AND (dedicated_transactional_token IS NULL OR dedicated_transactional_token = '')
  AND (dedicated_marketing_token IS NULL OR dedicated_marketing_token = '');

-- ============================================
-- VERIFY TOKEN POPULATION
-- ============================================
DO $$
DECLARE
    v_count_with_tokens INTEGER;
    v_count_total INTEGER;
BEGIN
    -- Count tenants with tokens
    SELECT COUNT(*) INTO v_count_with_tokens
    FROM contacts.postmark_settings
    WHERE shared_server_token IS NOT NULL 
       OR dedicated_transactional_token IS NOT NULL;
    
    -- Count total tenants
    SELECT COUNT(*) INTO v_count_total
    FROM contacts.postmark_settings;
    
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ POSTMARK TOKENS POPULATED!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Tenants with tokens: % / %', v_count_with_tokens, v_count_total;
    RAISE NOTICE '';
    RAISE NOTICE 'Token Assignments:';
    RAISE NOTICE '  • Default Shared: 59cf1ddb-d888-43b8-9d6d-a56879df5bd6';
    RAISE NOTICE '  • Vibenar: a99437c1-ce0c-4c50-800a-310c7257701a';
    RAISE NOTICE '  • MUS001 Betlemi10: fec0c42d-3701-463c-8f26-71545147be7e';
    RAISE NOTICE '  • AIX001 aiacademy.ge: 8e9d16a7-bb09-4fc0-8509-de30207de037';
    RAISE NOTICE '===========================================';
END $$;

-- Show final status
SELECT 
    ps.tenant_id,
    t.name as tenant_name,
    ps.server_mode,
    CASE 
        WHEN ps.server_mode = 'shared' AND ps.shared_server_token IS NOT NULL THEN '✅ Has shared token'
        WHEN ps.server_mode = 'dedicated' AND 
             (ps.dedicated_transactional_token IS NOT NULL OR ps.dedicated_marketing_token IS NOT NULL) THEN '✅ Has dedicated tokens'
        ELSE '❌ Missing tokens'
    END as token_status
FROM contacts.postmark_settings ps
LEFT JOIN public.tenants t ON t.id = ps.tenant_id
ORDER BY t.name;