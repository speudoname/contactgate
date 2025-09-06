-- ============================================
-- ContactGate Email System with Postmark Integration
-- ============================================
-- This migration adds comprehensive email capabilities to ContactGate
-- Based on pandaly-super-admin's proven architecture

-- ============================================
-- STEP 1: Add postmark_id to contacts.tenants (if exists)
-- ============================================
-- Note: Since ContactGate uses NumGate's tenants table, we'll check first

DO $$
DECLARE
    tenant_record RECORD;
    counter INTEGER := 1;
    prefix VARCHAR(3);
    new_postmark_id VARCHAR(6);
BEGIN
    -- Check if we need to add postmark_id to tenants
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants'
        AND column_name = 'postmark_id'
    ) THEN
        -- Add postmark_id if tenants table exists and doesn't have it
        ALTER TABLE public.tenants 
            ADD COLUMN postmark_id VARCHAR(6) UNIQUE;
        
        CREATE INDEX idx_tenants_postmark_id ON public.tenants(postmark_id);
        
        RAISE NOTICE 'Added postmark_id column to tenants table';
    END IF;
    
    -- Generate postmark_ids for existing tenants that don't have one
    FOR tenant_record IN 
        SELECT id, name, slug 
        FROM public.tenants 
        WHERE postmark_id IS NULL
        ORDER BY created_at
    LOOP
        -- Generate prefix from tenant name (first 3 letters, uppercase)
        prefix := UPPER(LEFT(REGEXP_REPLACE(COALESCE(tenant_record.name, tenant_record.slug, 'TEN'), '[^A-Za-z]', '', 'g'), 3));
        
        -- Pad with X if needed
        WHILE LENGTH(prefix) < 3 LOOP
            prefix := prefix || 'X';
        END LOOP;
        
        -- Generate unique ID with counter
        LOOP
            new_postmark_id := prefix || LPAD(counter::TEXT, 3, '0');
            
            -- Check if this ID already exists
            IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE postmark_id = new_postmark_id) THEN
                -- Update tenant with new postmark_id
                UPDATE public.tenants 
                SET postmark_id = new_postmark_id 
                WHERE id = tenant_record.id;
                
                RAISE NOTICE 'Assigned postmark_id % to tenant %', new_postmark_id, tenant_record.name;
                EXIT; -- Exit inner loop
            END IF;
            
            counter := counter + 1;
            
            -- Safety check to prevent infinite loop
            IF counter > 999 THEN
                RAISE EXCEPTION 'Could not generate unique postmark_id for tenant %', tenant_record.name;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- STEP 2: Create postmark_settings in contacts schema
-- ============================================

CREATE TABLE IF NOT EXISTS contacts.postmark_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Transactional Server Configuration
    transactional_server_id INTEGER,
    transactional_server_name TEXT,
    transactional_server_token TEXT, -- Should be encrypted in production
    transactional_stream_id TEXT DEFAULT 'outbound',
    transactional_stream_name TEXT DEFAULT 'Transactional',
    
    -- Marketing/Broadcast Server Configuration
    marketing_server_id INTEGER,
    marketing_server_name TEXT,
    marketing_server_token TEXT, -- Should be encrypted in production
    marketing_stream_id TEXT DEFAULT 'broadcasts',
    marketing_stream_name TEXT DEFAULT 'Marketing',
    
    -- Tracking Settings
    track_opens BOOLEAN DEFAULT false,
    track_links TEXT DEFAULT 'None', -- 'None', 'HtmlAndText', 'HtmlOnly', 'TextOnly'
    
    -- Domain Configuration
    domain_id INTEGER,
    domain_name TEXT,
    domain_verified BOOLEAN DEFAULT false,
    dkim_verified BOOLEAN DEFAULT false,
    spf_verified BOOLEAN DEFAULT false,
    return_path_verified BOOLEAN DEFAULT false,
    
    -- Default Sender Settings
    default_from_email TEXT,
    default_from_name TEXT,
    default_reply_to TEXT,
    
    -- Account Level Token (for server management)
    account_token TEXT, -- Should be encrypted in production
    
    -- Metadata
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_postmark_settings UNIQUE(tenant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_postmark_settings_tenant ON contacts.postmark_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_postmark_settings_servers ON contacts.postmark_settings(transactional_server_id, marketing_server_id);

-- ============================================
-- STEP 3: Create email campaigns table
-- ============================================

CREATE TABLE IF NOT EXISTS contacts.email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Campaign Details
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    preview_text TEXT,
    from_email TEXT NOT NULL,
    from_name TEXT NOT NULL,
    reply_to TEXT,
    
    -- Content
    html_body TEXT,
    text_body TEXT,
    template_id INTEGER, -- Postmark template ID if using template
    template_alias TEXT, -- Postmark template alias
    template_model JSONB, -- Template variables
    
    -- Configuration
    server_type TEXT DEFAULT 'marketing' CHECK (server_type IN ('transactional', 'marketing')),
    message_stream TEXT,
    track_opens BOOLEAN DEFAULT true,
    track_links TEXT DEFAULT 'HtmlAndText',
    
    -- Segmentation
    segment_type TEXT DEFAULT 'all' CHECK (segment_type IN ('all', 'filter', 'tags', 'manual')),
    segment_filters JSONB, -- Store filter conditions
    segment_tags TEXT[], -- Array of tag IDs
    manual_recipients TEXT[], -- Array of email addresses for manual selection
    
    -- Status and Scheduling
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Statistics
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    complained_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    
    -- Metadata
    tags TEXT[], -- Campaign tags for organization
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_campaigns_tenant ON contacts.email_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON contacts.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled ON contacts.email_campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created ON contacts.email_campaigns(created_at);

-- ============================================
-- STEP 4: Create email sends table (tracking individual sends)
-- ============================================

CREATE TABLE IF NOT EXISTS contacts.email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES contacts.email_campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts.contacts(id) ON DELETE CASCADE,
    
    -- Postmark Details
    message_id TEXT UNIQUE, -- Postmark message ID
    server_type TEXT CHECK (server_type IN ('transactional', 'marketing')),
    message_stream TEXT,
    
    -- Recipient Info (denormalized for history)
    to_email TEXT NOT NULL,
    to_name TEXT,
    
    -- Send Details
    subject TEXT,
    tag TEXT, -- Postmark tag
    metadata JSONB, -- Custom metadata
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'sent', 'delivered', 
        'opened', 'clicked', 'bounced', 'complained', 
        'unsubscribed', 'failed'
    )),
    
    -- Timestamps
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    first_opened_at TIMESTAMPTZ,
    last_opened_at TIMESTAMPTZ,
    open_count INTEGER DEFAULT 0,
    first_clicked_at TIMESTAMPTZ,
    last_clicked_at TIMESTAMPTZ,
    click_count INTEGER DEFAULT 0,
    bounced_at TIMESTAMPTZ,
    bounce_type TEXT,
    bounce_description TEXT,
    complained_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    
    -- Error Handling
    error_code INTEGER,
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_sends_tenant ON contacts.email_sends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON contacts.email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_contact ON contacts.email_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_message_id ON contacts.email_sends(message_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON contacts.email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_created ON contacts.email_sends(created_at);

-- ============================================
-- STEP 5: Create email templates table
-- ============================================

CREATE TABLE IF NOT EXISTS contacts.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Template Details
    name TEXT NOT NULL,
    alias TEXT, -- Postmark template alias
    postmark_template_id INTEGER, -- ID in Postmark
    
    -- Content
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    
    -- Template Variables
    variables JSONB, -- List of available variables and their defaults
    
    -- Configuration
    template_type TEXT DEFAULT 'custom' CHECK (template_type IN ('custom', 'system', 'postmark')),
    category TEXT, -- e.g., 'marketing', 'transactional', 'newsletter'
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_template_alias UNIQUE(tenant_id, alias)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON contacts.email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON contacts.email_templates(active);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON contacts.email_templates(category);

-- ============================================
-- STEP 6: Create email suppression list
-- ============================================

CREATE TABLE IF NOT EXISTS contacts.email_suppressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    email TEXT NOT NULL,
    contact_id UUID REFERENCES contacts.contacts(id) ON DELETE SET NULL,
    
    -- Suppression Type
    suppression_type TEXT NOT NULL CHECK (suppression_type IN (
        'unsubscribe', 'bounce', 'complaint', 'manual', 'global'
    )),
    
    -- Reason and Details
    reason TEXT,
    origin TEXT, -- 'user', 'admin', 'system', 'postmark'
    
    -- Scope
    applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'marketing', 'transactional')),
    
    -- Metadata
    suppressed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- For temporary suppressions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_email_suppression UNIQUE(tenant_id, email, suppression_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_suppressions_tenant ON contacts.email_suppressions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON contacts.email_suppressions(email);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_contact ON contacts.email_suppressions(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_type ON contacts.email_suppressions(suppression_type);

-- ============================================
-- STEP 7: Create email automation workflows
-- ============================================

CREATE TABLE IF NOT EXISTS contacts.email_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Automation Details
    name TEXT NOT NULL,
    description TEXT,
    
    -- Trigger Configuration
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'contact_created', 'tag_added', 'tag_removed', 
        'field_changed', 'date_based', 'event_triggered',
        'campaign_opened', 'campaign_clicked', 'form_submitted'
    )),
    trigger_config JSONB, -- Specific trigger configuration
    
    -- Email Sequence
    email_sequence JSONB, -- Array of email configs with delays
    
    -- Status
    active BOOLEAN DEFAULT false,
    
    -- Statistics
    total_enrolled INTEGER DEFAULT 0,
    currently_active INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    
    -- Metadata
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_automations_tenant ON contacts.email_automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_automations_active ON contacts.email_automations(active);
CREATE INDEX IF NOT EXISTS idx_email_automations_trigger ON contacts.email_automations(trigger_type);

-- ============================================
-- STEP 8: Create helper functions
-- ============================================

-- Function to get postmark settings for a tenant
CREATE OR REPLACE FUNCTION contacts.get_postmark_settings(p_tenant_id UUID)
RETURNS TABLE (
    postmark_id VARCHAR(6),
    transactional_server_id INTEGER,
    transactional_server_token TEXT,
    transactional_stream_id TEXT,
    marketing_server_id INTEGER,
    marketing_server_token TEXT,
    marketing_stream_id TEXT,
    track_opens BOOLEAN,
    track_links TEXT,
    default_from_email TEXT,
    default_from_name TEXT,
    domain_verified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.postmark_id,
        ps.transactional_server_id,
        ps.transactional_server_token,
        ps.transactional_stream_id,
        ps.marketing_server_id,
        ps.marketing_server_token,
        ps.marketing_stream_id,
        ps.track_opens,
        ps.track_links,
        ps.default_from_email,
        ps.default_from_name,
        ps.domain_verified
    FROM public.tenants t
    LEFT JOIN contacts.postmark_settings ps ON ps.tenant_id = t.id
    WHERE t.id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if email is suppressed
CREATE OR REPLACE FUNCTION contacts.is_email_suppressed(
    p_tenant_id UUID,
    p_email TEXT,
    p_email_type TEXT DEFAULT 'marketing'
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM contacts.email_suppressions
        WHERE tenant_id = p_tenant_id
        AND LOWER(email) = LOWER(p_email)
        AND (applies_to = 'all' OR applies_to = p_email_type)
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 9: Create triggers for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION contacts.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables
CREATE TRIGGER update_postmark_settings_updated_at BEFORE UPDATE ON contacts.postmark_settings
    FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON contacts.email_campaigns
    FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at_column();

CREATE TRIGGER update_email_sends_updated_at BEFORE UPDATE ON contacts.email_sends
    FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON contacts.email_templates
    FOR EACH ROW EXECUTE FUNCTION contacts.update_updated_at_column();

-- ============================================
-- STEP 10: Insert default Postmark settings for testing
-- ============================================

-- Note: Update this with your actual Postmark account token
DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Get a tenant ID for testing (you can specify a specific one)
    SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
    
    IF v_tenant_id IS NOT NULL THEN
        -- Insert default Postmark settings if not exists
        INSERT INTO contacts.postmark_settings (
            tenant_id,
            account_token,
            track_opens,
            track_links,
            default_from_email,
            default_from_name,
            default_reply_to
        )
        VALUES (
            v_tenant_id,
            '043d0e1c-f24a-4f8a-9b8e-41b22715ee53', -- From pandaly project
            false, -- Don't track opens for transactional by default
            'None', -- Don't track links for transactional by default
            'noreply@example.com',
            'ContactGate',
            'support@example.com'
        )
        ON CONFLICT (tenant_id) DO NOTHING;
        
        RAISE NOTICE 'Added default Postmark settings for testing';
    END IF;
END $$;

-- ============================================
-- FINAL LOG
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'contacts' 
    AND table_name IN (
        'postmark_settings', 'email_campaigns', 'email_sends', 
        'email_templates', 'email_suppressions', 'email_automations'
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ ContactGate Email System Setup Complete!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Created % email-related tables', table_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - contacts.postmark_settings';
    RAISE NOTICE '  - contacts.email_campaigns';
    RAISE NOTICE '  - contacts.email_sends';
    RAISE NOTICE '  - contacts.email_templates';
    RAISE NOTICE '  - contacts.email_suppressions';
    RAISE NOTICE '  - contacts.email_automations';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Update Postmark account token in settings';
    RAISE NOTICE '  2. Configure tenant-specific servers';
    RAISE NOTICE '  3. Set up domain verification';
    RAISE NOTICE '  4. Create email templates';
    RAISE NOTICE '===========================================';
END $$;