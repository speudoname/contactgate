-- Fix permissions for shared_postmark_config table
-- Grant all permissions to service_role and authenticated roles

-- Grant usage on contacts schema
GRANT USAGE ON SCHEMA contacts TO service_role, authenticated, anon;

-- Grant all privileges on the shared_postmark_config table to service_role
GRANT ALL PRIVILEGES ON contacts.shared_postmark_config TO service_role;
GRANT ALL PRIVILEGES ON contacts.shared_postmark_config TO authenticated;

-- Grant usage on any sequences (for auto-increment id)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA contacts TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA contacts TO authenticated;

-- Ensure service_role can see the table in the schema
ALTER TABLE contacts.shared_postmark_config OWNER TO postgres;

-- Create a policy that allows service_role to do everything (if RLS is enabled)
ALTER TABLE contacts.shared_postmark_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role has full access" ON contacts.shared_postmark_config;
DROP POLICY IF EXISTS "Authenticated users can read" ON contacts.shared_postmark_config;

-- Create new policies
CREATE POLICY "Service role has full access" ON contacts.shared_postmark_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read" ON contacts.shared_postmark_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify the fix
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'contacts' 
AND tablename = 'shared_postmark_config';

-- Check current permissions
SELECT 
  grantee, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'contacts' 
AND table_name = 'shared_postmark_config';