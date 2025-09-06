-- Setup Row Level Security for ContactGate tables
-- This ensures proper tenant isolation

-- 1. Enable RLS on contacts schema tables
ALTER TABLE contacts.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.lifecycle_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.tag_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.custom_field_values ENABLE ROW LEVEL SECURITY;

-- 2. Create simple, efficient policies for contacts.contacts
-- Service role bypass (for API routes using service key)
CREATE POLICY "Service role bypass" ON contacts.contacts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Tenant isolation for authenticated users
CREATE POLICY "Tenant isolation" ON contacts.contacts
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt()->>'tenant_id')
    WITH CHECK (tenant_id = auth.jwt()->>'tenant_id');

-- 3. Create policies for contacts.events
CREATE POLICY "Service role bypass" ON contacts.events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Tenant isolation" ON contacts.events
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt()->>'tenant_id')
    WITH CHECK (tenant_id = auth.jwt()->>'tenant_id');

-- 4. Create policies for lifecycle_stages
CREATE POLICY "Service role bypass" ON contacts.lifecycle_stages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Tenant isolation" ON contacts.lifecycle_stages
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt()->>'tenant_id')
    WITH CHECK (tenant_id = auth.jwt()->>'tenant_id');

-- 5. Create policies for sources
CREATE POLICY "Service role bypass" ON contacts.sources
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Tenant isolation" ON contacts.sources
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt()->>'tenant_id')
    WITH CHECK (tenant_id = auth.jwt()->>'tenant_id');

-- 6. Create policies for tag_definitions
CREATE POLICY "Service role bypass" ON contacts.tag_definitions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Tenant isolation" ON contacts.tag_definitions
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt()->>'tenant_id')
    WITH CHECK (tenant_id = auth.jwt()->>'tenant_id');

-- 7. Create policies for contact_tags
CREATE POLICY "Service role bypass" ON contacts.contact_tags
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Tenant isolation" ON contacts.contact_tags
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt()->>'tenant_id')
    WITH CHECK (tenant_id = auth.jwt()->>'tenant_id');

-- 8. Create policies for custom_field_definitions
CREATE POLICY "Service role bypass" ON contacts.custom_field_definitions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Tenant isolation" ON contacts.custom_field_definitions
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt()->>'tenant_id')
    WITH CHECK (tenant_id = auth.jwt()->>'tenant_id');

-- 9. Create policies for custom_field_values  
CREATE POLICY "Service role bypass" ON contacts.custom_field_values
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Tenant isolation" ON contacts.custom_field_values
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt()->>'tenant_id')
    WITH CHECK (tenant_id = auth.jwt()->>'tenant_id');

-- Check the results
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'contacts'
GROUP BY tablename;