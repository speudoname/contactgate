-- This script will help you determine which schema structure you have in Supabase
-- Run this in the Supabase SQL Editor to understand your current setup

-- 1. Check which schemas exist
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY schema_name;

-- 2. Check if contacts table exists in public schema
SELECT 
  'public.contacts' as table_location,
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'contacts'
  ) as exists;

-- 3. Check if contacts table exists in contacts schema
SELECT 
  'contacts.contacts' as table_location,
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'contacts' 
    AND table_name = 'contacts'
  ) as exists;

-- 4. List all tables in the contacts schema (if it exists)
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'contacts'
ORDER BY table_name;

-- 5. List all tables in the public schema that might be contact-related
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('contacts', 'events', 'segments', 'campaigns', 'tenants', 'users')
ORDER BY table_name;

-- 6. Get column structure of contacts table (regardless of schema)
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts'
  AND table_schema IN ('public', 'contacts')
ORDER BY table_schema, ordinal_position;

-- 7. Check which schemas are exposed in the REST API
-- Note: This info is also visible in Supabase Dashboard under Settings > API
SELECT 
  schema_name,
  'Check if exposed in Supabase Dashboard > Settings > API' as note
FROM information_schema.schemata 
WHERE schema_name IN ('public', 'contacts');

-- 8. Test query for public.contacts
-- Uncomment and run if public.contacts exists
/*
SELECT COUNT(*) as contact_count 
FROM public.contacts;
*/

-- 9. Test query for contacts.contacts
-- Uncomment and run if contacts.contacts exists
/*
SELECT COUNT(*) as contact_count 
FROM contacts.contacts;
*/