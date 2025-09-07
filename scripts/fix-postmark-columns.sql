-- Fix column names in postmark_settings table to match the schema
-- This handles the case where columns might have been created with different names

DO $$
BEGIN
    -- Check if we have the old column names and rename them
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'server_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'transactional_server_id'
    ) THEN
        -- Rename server_id to transactional_server_id
        ALTER TABLE contacts.postmark_settings 
        RENAME COLUMN server_id TO transactional_server_id;
        
        RAISE NOTICE 'Renamed server_id to transactional_server_id';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'server_token'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'transactional_server_token'
    ) THEN
        -- Rename server_token to transactional_server_token
        ALTER TABLE contacts.postmark_settings 
        RENAME COLUMN server_token TO transactional_server_token;
        
        RAISE NOTICE 'Renamed server_token to transactional_server_token';
    END IF;

    -- Add any missing columns that should exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'transactional_server_id'
    ) THEN
        ALTER TABLE contacts.postmark_settings 
        ADD COLUMN transactional_server_id INTEGER;
        
        RAISE NOTICE 'Added transactional_server_id column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'transactional_server_token'
    ) THEN
        ALTER TABLE contacts.postmark_settings 
        ADD COLUMN transactional_server_token TEXT;
        
        RAISE NOTICE 'Added transactional_server_token column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'transactional_stream_id'
    ) THEN
        ALTER TABLE contacts.postmark_settings 
        ADD COLUMN transactional_stream_id TEXT DEFAULT 'outbound';
        
        RAISE NOTICE 'Added transactional_stream_id column';
    END IF;

    -- Ensure marketing columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'marketing_server_id'
    ) THEN
        ALTER TABLE contacts.postmark_settings 
        ADD COLUMN marketing_server_id INTEGER;
        
        RAISE NOTICE 'Added marketing_server_id column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'marketing_server_token'
    ) THEN
        ALTER TABLE contacts.postmark_settings 
        ADD COLUMN marketing_server_token TEXT;
        
        RAISE NOTICE 'Added marketing_server_token column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'marketing_stream_id'
    ) THEN
        ALTER TABLE contacts.postmark_settings 
        ADD COLUMN marketing_stream_id TEXT DEFAULT 'broadcasts';
        
        RAISE NOTICE 'Added marketing_stream_id column';
    END IF;

    -- Copy data from old columns if they exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'server_id'
    ) THEN
        UPDATE contacts.postmark_settings 
        SET transactional_server_id = server_id
        WHERE transactional_server_id IS NULL AND server_id IS NOT NULL;
        
        -- Drop the old column
        ALTER TABLE contacts.postmark_settings DROP COLUMN IF EXISTS server_id;
        RAISE NOTICE 'Migrated data from server_id and dropped old column';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'contacts' 
        AND table_name = 'postmark_settings' 
        AND column_name = 'server_token'
    ) THEN
        UPDATE contacts.postmark_settings 
        SET transactional_server_token = server_token
        WHERE transactional_server_token IS NULL AND server_token IS NOT NULL;
        
        -- Drop the old column
        ALTER TABLE contacts.postmark_settings DROP COLUMN IF EXISTS server_token;
        RAISE NOTICE 'Migrated data from server_token and dropped old column';
    END IF;

END $$;

-- Show current structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'contacts' AND table_name = 'postmark_settings'
ORDER BY ordinal_position;