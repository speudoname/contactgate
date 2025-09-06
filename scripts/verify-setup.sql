-- Verification queries to run after setup

-- 1. Check if all tables were created
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('tenants', 'users', 'contacts') THEN '✅ Created'
    ELSE '❌ Missing'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tenants', 'users', 'contacts')
ORDER BY table_name;

-- 2. Check column structure of contacts table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contacts'
ORDER BY ordinal_position;

-- 3. Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'contacts';

-- 4. Check triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('contacts', 'tenants', 'users');

-- 5. Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'users', 'contacts');

-- 6. Insert test data
-- First, create a test tenant
INSERT INTO public.tenants (name, subdomain)
VALUES ('Test Company', 'test-company')
ON CONFLICT (subdomain) DO NOTHING
RETURNING id, name, subdomain;

-- Get the tenant_id (you'll need this for the next query)
-- Run this to get the tenant_id:
SELECT id FROM public.tenants WHERE subdomain = 'test-company';

-- 7. Insert a test contact (replace <tenant_id> with the actual UUID from above)
-- Example:
/*
INSERT INTO public.contacts (
  tenant_id,
  email,
  phone,
  first_name,
  last_name,
  company,
  job_title,
  lifecycle_stage,
  source,
  email_opt_in
) VALUES (
  '<tenant_id>', -- Replace with actual tenant_id from query above
  'john.doe@example.com',
  '+1-555-0123',
  'John',
  'Doe',
  'Acme Corp',
  'Software Engineer',
  'lead',
  'website',
  true
)
RETURNING id, email, full_name, created_at;
*/

-- 8. Verify the contact was created with computed column
SELECT 
  id,
  email,
  first_name,
  last_name,
  full_name, -- This should be automatically computed
  lifecycle_stage,
  created_at
FROM public.contacts
WHERE email = 'john.doe@example.com';

-- 9. Test the update trigger
/*
UPDATE public.contacts
SET job_title = 'Senior Software Engineer'
WHERE email = 'john.doe@example.com'
RETURNING updated_at; -- Should be different from created_at
*/

-- 10. Clean up test data (optional)
/*
DELETE FROM public.tenants WHERE subdomain = 'test-company';
-- This should cascade delete the contact due to ON DELETE CASCADE
*/