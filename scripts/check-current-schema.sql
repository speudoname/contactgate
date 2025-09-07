-- Check current schema of postmark_settings table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'contacts' 
AND table_name = 'postmark_settings'
ORDER BY ordinal_position;

-- Check if shared_postmark_config exists and its columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'contacts' 
AND table_name = 'shared_postmark_config'
ORDER BY ordinal_position;

-- Check current data in postmark_settings
SELECT * FROM contacts.postmark_settings LIMIT 5;

-- Check current data in shared_postmark_config if it exists
SELECT * FROM contacts.shared_postmark_config LIMIT 5;