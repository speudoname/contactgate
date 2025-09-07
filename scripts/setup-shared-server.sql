-- Setup Shared Server Configuration
-- This script configures the existing "defaultsharednumgate" server for shared use

-- Since we can't directly fetch from Postmark API via SQL, 
-- we'll set up the configuration that should match the existing server
-- The actual server token needs to be obtained from Postmark dashboard or API

DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if shared config already exists
  SELECT EXISTS(SELECT 1 FROM contacts.shared_postmark_config) INTO v_exists;
  
  IF NOT v_exists THEN
    -- Insert shared server configuration
    -- NOTE: You need to replace these tokens with actual values from Postmark
    INSERT INTO contacts.shared_postmark_config (
      transactional_server_token,
      transactional_server_id,
      transactional_stream_id,
      marketing_server_token,
      marketing_server_id,
      marketing_stream_id,
      default_from_email,
      default_from_name,
      default_reply_to
    ) VALUES (
      -- These need to be replaced with actual values
      'REPLACE_WITH_ACTUAL_SERVER_TOKEN', -- Get this from Postmark dashboard for defaultsharednumgate
      NULL, -- Server ID will be fetched from API
      'outbound', -- Default transactional stream
      'REPLACE_WITH_ACTUAL_SERVER_TOKEN', -- Same server, different stream for marketing
      NULL, -- Same server ID
      'broadcasts', -- Default marketing stream
      'share@share.komunate.com',
      'Komunate Platform',
      'noreply@komunate.com'
    );
    
    RAISE NOTICE 'Shared server configuration created.';
    RAISE NOTICE 'IMPORTANT: You must update the server tokens with actual values from Postmark!';
    RAISE NOTICE '1. Go to Postmark dashboard';
    RAISE NOTICE '2. Find the "defaultsharednumgate" server';
    RAISE NOTICE '3. Get the server API token';
    RAISE NOTICE '4. Update the tokens in the shared_postmark_config table';
  ELSE
    RAISE NOTICE 'Shared server configuration already exists.';
  END IF;
END $$;

-- Query to verify the configuration
SELECT 
  'Shared Server Config' as config_type,
  CASE 
    WHEN transactional_server_token = 'REPLACE_WITH_ACTUAL_SERVER_TOKEN' 
    THEN '❌ Token not configured - needs update'
    ELSE '✅ Token configured'
  END as status,
  default_from_email,
  default_from_name,
  transactional_stream_id,
  marketing_stream_id
FROM contacts.shared_postmark_config;