-- Create contacts schema for separation
CREATE SCHEMA IF NOT EXISTS contacts;

-- Main contacts table
CREATE TABLE contacts.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Basic Information
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
      WHEN first_name IS NOT NULL THEN first_name
      WHEN last_name IS NOT NULL THEN last_name
      ELSE NULL
    END
  ) STORED,
  
  -- Contact Type
  is_authenticated BOOLEAN DEFAULT false, -- Can they log in?
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Link to user if authenticated
  
  -- Additional Info
  company TEXT,
  job_title TEXT,
  website TEXT,
  timezone TEXT,
  language TEXT DEFAULT 'en',
  avatar_url TEXT,
  
  -- Location
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Source & Attribution
  source TEXT, -- Where they came from (landing_page, webinar, import, manual, etc.)
  source_details JSONB DEFAULT '{}', -- Additional source info
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referring_url TEXT,
  
  -- Engagement
  lead_score INTEGER DEFAULT 0,
  lifecycle_stage TEXT DEFAULT 'subscriber', -- subscriber, lead, opportunity, customer, evangelist
  status TEXT DEFAULT 'active', -- active, inactive, unsubscribed, bounced
  
  -- Communication Preferences
  email_opt_in BOOLEAN DEFAULT false,
  sms_opt_in BOOLEAN DEFAULT false,
  marketing_opt_in BOOLEAN DEFAULT false,
  
  -- Custom Fields (tenant-specific)
  custom_fields JSONB DEFAULT '{}',
  
  -- Tags (array of tag IDs)
  tags UUID[] DEFAULT '{}',
  
  -- Metadata
  notes TEXT,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, user_id)
);

-- Events table for activity tracking
CREATE TABLE contacts.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts.contacts(id) ON DELETE CASCADE,
  
  -- Event Details
  event_type TEXT NOT NULL, -- page_view, form_submit, email_open, purchase, etc.
  event_category TEXT, -- engagement, conversion, system, etc.
  source_app TEXT, -- page_builder, email, webinar, lms, etc.
  
  -- Event Data
  properties JSONB DEFAULT '{}', -- Event-specific data
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_events_tenant_contact (tenant_id, contact_id),
  INDEX idx_events_type (event_type),
  INDEX idx_events_created (created_at DESC)
);

-- Tags table
CREATE TABLE contacts.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  color TEXT DEFAULT '#gray',
  description TEXT,
  
  -- Usage tracking
  contact_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

-- Segments table (dynamic filtering)
CREATE TABLE contacts.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Segment Rules (stored as JSON)
  rules JSONB NOT NULL, -- Complex filtering rules
  
  -- Cached Results
  contact_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

-- Custom fields definition (per tenant)
CREATE TABLE contacts.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  field_key TEXT NOT NULL, -- Internal key
  field_label TEXT NOT NULL, -- Display label
  field_type TEXT NOT NULL, -- text, number, date, select, etc.
  field_options JSONB DEFAULT '{}', -- For select fields, validation rules, etc.
  
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, field_key)
);

-- Lists (static groups)
CREATE TABLE contacts.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

-- List memberships
CREATE TABLE contacts.list_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES contacts.lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts.contacts(id) ON DELETE CASCADE,
  
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(list_id, contact_id)
);

-- Create indexes for performance
CREATE INDEX idx_contacts_tenant ON contacts.contacts(tenant_id);
CREATE INDEX idx_contacts_email ON contacts.contacts(email);
CREATE INDEX idx_contacts_lifecycle ON contacts.contacts(lifecycle_stage);
CREATE INDEX idx_contacts_created ON contacts.contacts(created_at DESC);
CREATE INDEX idx_contacts_activity ON contacts.contacts(last_activity_at DESC);
CREATE INDEX idx_contacts_tags ON contacts.contacts USING GIN(tags);

-- RLS Policies (following NumGate pattern - service key with tenant filtering)
ALTER TABLE contacts.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.list_memberships ENABLE ROW LEVEL SECURITY;

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION contacts.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts.contacts
  FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at();

CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON contacts.tags
  FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at();

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON contacts.segments
  FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at();

CREATE TRIGGER update_custom_fields_updated_at BEFORE UPDATE ON contacts.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at();

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON contacts.lists
  FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at();

-- Function to update last_activity_at when events are created
CREATE OR REPLACE FUNCTION contacts.update_contact_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts.contacts 
  SET last_activity_at = NEW.created_at
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_activity_on_event
  AFTER INSERT ON contacts.events
  FOR EACH ROW EXECUTE FUNCTION contacts.update_contact_activity();

-- Grant permissions for service role
GRANT ALL ON SCHEMA contacts TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA contacts TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA contacts TO service_role;