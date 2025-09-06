-- Phase 1: Create reference tables for ContactGate
-- This script creates configurable reference data tables

-- 1. Lifecycle Stages table
CREATE TABLE IF NOT EXISTS contacts.lifecycle_stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  color TEXT DEFAULT '#10b981', -- Tailwind green-500
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- System stages can't be deleted
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 2. Contact Sources table
CREATE TABLE IF NOT EXISTS contacts.sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  icon TEXT, -- Optional icon identifier
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 3. Tag Definitions table
CREATE TABLE IF NOT EXISTS contacts.tag_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1', -- Tailwind indigo-500
  category TEXT, -- Optional grouping
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 4. Contact Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS contacts.contact_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES contacts.tag_definitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  UNIQUE(contact_id, tag_id)
);

-- 5. Custom Field Definitions
CREATE TABLE IF NOT EXISTS contacts.custom_field_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select', 'multiselect')),
  options JSONB, -- For select/multiselect types
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, field_name)
);

-- 6. Custom Field Values
CREATE TABLE IF NOT EXISTS contacts.custom_field_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts.contacts(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES contacts.custom_field_definitions(id) ON DELETE CASCADE,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, field_id)
);

-- 7. Activity Summary View (for quick stats)
CREATE OR REPLACE VIEW contacts.contact_activity_summary AS
SELECT 
  c.id as contact_id,
  c.tenant_id,
  COUNT(DISTINCT e.id) as total_events,
  COUNT(DISTINCT CASE WHEN e.event_type LIKE 'email.%' THEN e.id END) as email_events,
  COUNT(DISTINCT CASE WHEN e.event_type LIKE 'webinar.%' THEN e.id END) as webinar_events,
  COUNT(DISTINCT CASE WHEN e.event_type LIKE 'course.%' THEN e.id END) as course_events,
  MAX(e.created_at) as last_activity_at
FROM contacts.contacts c
LEFT JOIN contacts.events e ON c.id = e.contact_id
GROUP BY c.id, c.tenant_id;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_tenant_id ON contacts.lifecycle_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sources_tenant_id ON contacts.sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tag_definitions_tenant_id ON contacts.tag_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contacts.contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON contacts.contact_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_contact_id ON contacts.custom_field_values(contact_id);
CREATE INDEX IF NOT EXISTS idx_events_contact_id ON contacts.events(contact_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON contacts.events(event_type);

-- Fix security warnings: Set search_path for functions
-- This addresses the "Function Search Path Mutable" warnings

-- Fix the update_updated_at_column function
CREATE OR REPLACE FUNCTION contacts.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = contacts, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to new tables
DROP TRIGGER IF EXISTS update_lifecycle_stages_updated_at ON contacts.lifecycle_stages;
CREATE TRIGGER update_lifecycle_stages_updated_at 
  BEFORE UPDATE ON contacts.lifecycle_stages
  FOR EACH ROW
  EXECUTE FUNCTION contacts.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sources_updated_at ON contacts.sources;
CREATE TRIGGER update_sources_updated_at 
  BEFORE UPDATE ON contacts.sources
  FOR EACH ROW
  EXECUTE FUNCTION contacts.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tag_definitions_updated_at ON contacts.tag_definitions;
CREATE TRIGGER update_tag_definitions_updated_at 
  BEFORE UPDATE ON contacts.tag_definitions
  FOR EACH ROW
  EXECUTE FUNCTION contacts.update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_field_definitions_updated_at ON contacts.custom_field_definitions;
CREATE TRIGGER update_custom_field_definitions_updated_at 
  BEFORE UPDATE ON contacts.custom_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION contacts.update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_field_values_updated_at ON contacts.custom_field_values;
CREATE TRIGGER update_custom_field_values_updated_at 
  BEFORE UPDATE ON contacts.custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION contacts.update_updated_at_column();

-- Insert default lifecycle stages for each tenant
INSERT INTO contacts.lifecycle_stages (tenant_id, name, display_name, color, order_index, is_system)
SELECT 
  t.id,
  stage.name,
  stage.display_name,
  stage.color,
  stage.order_index,
  true
FROM public.tenants t
CROSS JOIN (
  VALUES 
    ('subscriber', 'Subscriber', '#6b7280', 1),
    ('lead', 'Lead', '#10b981', 2),
    ('marketing_qualified_lead', 'Marketing Qualified Lead', '#3b82f6', 3),
    ('sales_qualified_lead', 'Sales Qualified Lead', '#8b5cf6', 4),
    ('opportunity', 'Opportunity', '#f59e0b', 5),
    ('customer', 'Customer', '#ef4444', 6),
    ('evangelist', 'Evangelist', '#ec4899', 7)
) AS stage(name, display_name, color, order_index)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Insert default sources for each tenant
INSERT INTO contacts.sources (tenant_id, name, display_name, is_system)
SELECT 
  t.id,
  source.name,
  source.display_name,
  true
FROM public.tenants t
CROSS JOIN (
  VALUES 
    ('manual', 'Manual Entry'),
    ('website', 'Website'),
    ('referral', 'Referral'),
    ('social', 'Social Media'),
    ('email', 'Email Campaign'),
    ('import', 'Import'),
    ('api', 'API'),
    ('webinar', 'Webinar'),
    ('landing_page', 'Landing Page')
) AS source(name, display_name)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA contacts TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA contacts TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA contacts TO service_role;