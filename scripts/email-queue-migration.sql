-- ============================================
-- Email Queue System Migration
-- ============================================
-- This migration:
-- 1. Drops unused email tables (keeping email_templates)
-- 2. Creates new email queue tables for transactional and marketing emails
-- ============================================

-- STEP 1: Drop unused tables (keeping email_templates and email_campaigns as requested)
-- ============================================

DROP TABLE IF EXISTS contacts.email_automations CASCADE;
DROP TABLE IF EXISTS contacts.email_sends CASCADE;
DROP TABLE IF EXISTS contacts.email_suppressions CASCADE;

-- Note: Triggers are automatically dropped when tables are dropped with CASCADE

-- STEP 2: Create new email queue tables
-- ============================================

-- Transactional Email Queue (high priority, immediate sending)
CREATE TABLE IF NOT EXISTS contacts.email_queue_transactional (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Email details
    to_email TEXT NOT NULL,
    to_name TEXT,
    from_email TEXT,
    from_name TEXT,
    reply_to TEXT,
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    
    -- Configuration
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- Higher = more urgent
    message_stream TEXT DEFAULT 'transactional',
    tag TEXT,
    metadata JSONB,
    
    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Error tracking
    last_error TEXT,
    error_details JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_for TIMESTAMPTZ DEFAULT NOW(), -- Can schedule for future
    processing_started_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    
    -- Postmark response
    postmark_message_id TEXT,
    postmark_response JSONB
);

-- Marketing Email Queue (bulk sending, lower priority)
CREATE TABLE IF NOT EXISTS contacts.email_queue_marketing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Campaign reference
    campaign_id UUID,
    campaign_name TEXT,
    
    -- Contact reference
    contact_id UUID REFERENCES contacts.contacts(id) ON DELETE SET NULL,
    
    -- Email details
    to_email TEXT NOT NULL,
    to_name TEXT,
    from_email TEXT,
    from_name TEXT,
    reply_to TEXT,
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    
    -- Personalization
    personalization JSONB, -- Variable substitutions
    
    -- Configuration
    message_stream TEXT DEFAULT 'marketing',
    tag TEXT,
    metadata JSONB,
    track_opens BOOLEAN DEFAULT true,
    track_links TEXT DEFAULT 'HtmlAndText',
    
    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'unsubscribed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 2,
    
    -- Error tracking
    last_error TEXT,
    error_details JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    processing_started_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    
    -- Postmark response
    postmark_message_id TEXT,
    postmark_response JSONB
);

-- Note: We're keeping the existing contacts.email_campaigns table
-- It already has the necessary columns for campaign management

-- STEP 3: Create indexes for performance
-- ============================================

-- Transactional queue indexes
CREATE INDEX idx_email_queue_trans_tenant ON contacts.email_queue_transactional(tenant_id);
CREATE INDEX idx_email_queue_trans_status ON contacts.email_queue_transactional(status);
CREATE INDEX idx_email_queue_trans_scheduled ON contacts.email_queue_transactional(scheduled_for) 
    WHERE status = 'pending';
CREATE INDEX idx_email_queue_trans_priority ON contacts.email_queue_transactional(priority DESC, created_at) 
    WHERE status = 'pending';

-- Marketing queue indexes
CREATE INDEX idx_email_queue_mark_tenant ON contacts.email_queue_marketing(tenant_id);
CREATE INDEX idx_email_queue_mark_status ON contacts.email_queue_marketing(status);
CREATE INDEX idx_email_queue_mark_campaign ON contacts.email_queue_marketing(campaign_id);
CREATE INDEX idx_email_queue_mark_scheduled ON contacts.email_queue_marketing(scheduled_for) 
    WHERE status = 'pending';
CREATE INDEX idx_email_queue_mark_contact ON contacts.email_queue_marketing(contact_id);

-- Campaigns indexes (if not already exist)
CREATE INDEX IF NOT EXISTS idx_email_campaigns_tenant ON contacts.email_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON contacts.email_campaigns(status);

-- STEP 4: Create helper functions
-- ============================================

-- Function to get next batch of emails to process
CREATE OR REPLACE FUNCTION contacts.get_pending_emails(
    p_queue_type TEXT, -- 'transactional' or 'marketing'
    p_batch_size INTEGER DEFAULT 500
) RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    to_email TEXT,
    from_email TEXT,
    subject TEXT,
    html_body TEXT,
    text_body TEXT,
    metadata JSONB
) AS $$
BEGIN
    IF p_queue_type = 'transactional' THEN
        RETURN QUERY
        UPDATE contacts.email_queue_transactional
        SET status = 'processing',
            processing_started_at = NOW(),
            attempts = attempts + 1
        WHERE id IN (
            SELECT id 
            FROM contacts.email_queue_transactional
            WHERE status = 'pending'
            AND scheduled_for <= NOW()
            AND attempts < max_attempts
            ORDER BY priority DESC, created_at
            LIMIT p_batch_size
            FOR UPDATE SKIP LOCKED
        )
        RETURNING 
            email_queue_transactional.id,
            email_queue_transactional.tenant_id,
            email_queue_transactional.to_email,
            email_queue_transactional.from_email,
            email_queue_transactional.subject,
            email_queue_transactional.html_body,
            email_queue_transactional.text_body,
            email_queue_transactional.metadata;
    ELSE
        RETURN QUERY
        UPDATE contacts.email_queue_marketing
        SET status = 'processing',
            processing_started_at = NOW(),
            attempts = attempts + 1
        WHERE id IN (
            SELECT id 
            FROM contacts.email_queue_marketing
            WHERE status = 'pending'
            AND scheduled_for <= NOW()
            AND attempts < max_attempts
            ORDER BY created_at
            LIMIT p_batch_size
            FOR UPDATE SKIP LOCKED
        )
        RETURNING 
            email_queue_marketing.id,
            email_queue_marketing.tenant_id,
            email_queue_marketing.to_email,
            email_queue_marketing.from_email,
            email_queue_marketing.subject,
            email_queue_marketing.html_body,
            email_queue_marketing.text_body,
            email_queue_marketing.metadata;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to mark email as sent
CREATE OR REPLACE FUNCTION contacts.mark_email_sent(
    p_queue_type TEXT,
    p_email_id UUID,
    p_message_id TEXT,
    p_response JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    IF p_queue_type = 'transactional' THEN
        UPDATE contacts.email_queue_transactional
        SET status = 'sent',
            sent_at = NOW(),
            processed_at = NOW(),
            postmark_message_id = p_message_id,
            postmark_response = p_response
        WHERE id = p_email_id;
    ELSE
        UPDATE contacts.email_queue_marketing
        SET status = 'sent',
            sent_at = NOW(),
            processed_at = NOW(),
            postmark_message_id = p_message_id,
            postmark_response = p_response
        WHERE id = p_email_id;
        
        -- Update campaign statistics
        UPDATE contacts.email_campaigns
        SET sent_count = sent_count + 1
        WHERE id = (
            SELECT campaign_id 
            FROM contacts.email_queue_marketing 
            WHERE id = p_email_id
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to mark email as failed
CREATE OR REPLACE FUNCTION contacts.mark_email_failed(
    p_queue_type TEXT,
    p_email_id UUID,
    p_error TEXT,
    p_error_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_attempts INTEGER;
    v_max_attempts INTEGER;
BEGIN
    IF p_queue_type = 'transactional' THEN
        SELECT attempts, max_attempts 
        INTO v_attempts, v_max_attempts
        FROM contacts.email_queue_transactional
        WHERE id = p_email_id;
        
        UPDATE contacts.email_queue_transactional
        SET status = CASE 
                WHEN v_attempts >= v_max_attempts THEN 'failed'
                ELSE 'pending' -- Will retry
            END,
            last_error = p_error,
            error_details = p_error_details,
            processed_at = CASE 
                WHEN v_attempts >= v_max_attempts THEN NOW()
                ELSE NULL
            END
        WHERE id = p_email_id;
    ELSE
        SELECT attempts, max_attempts 
        INTO v_attempts, v_max_attempts
        FROM contacts.email_queue_marketing
        WHERE id = p_email_id;
        
        UPDATE contacts.email_queue_marketing
        SET status = CASE 
                WHEN v_attempts >= v_max_attempts THEN 'failed'
                ELSE 'pending'
            END,
            last_error = p_error,
            error_details = p_error_details,
            processed_at = CASE 
                WHEN v_attempts >= v_max_attempts THEN NOW()
                ELSE NULL
            END
        WHERE id = p_email_id;
        
        -- Update campaign statistics if final failure
        IF v_attempts >= v_max_attempts THEN
            UPDATE contacts.email_campaigns
            SET failed_count = failed_count + 1
            WHERE id = (
                SELECT campaign_id 
                FROM contacts.email_queue_marketing 
                WHERE id = p_email_id
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: Grant permissions
-- ============================================

GRANT ALL ON contacts.email_queue_transactional TO authenticated;
GRANT ALL ON contacts.email_queue_marketing TO authenticated;
-- Note: contacts.email_campaigns should already have permissions

-- STEP 6: Enable Row Level Security (optional but recommended)
-- ============================================

ALTER TABLE contacts.email_queue_transactional ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts.email_queue_marketing ENABLE ROW LEVEL SECURITY;
-- Note: contacts.email_campaigns should already have RLS enabled

-- Create RLS policies
CREATE POLICY "Tenants can manage their own transactional emails" ON contacts.email_queue_transactional
    FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Tenants can manage their own marketing emails" ON contacts.email_queue_marketing
    FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ Email Queue System Migration Complete!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Dropped tables:';
    RAISE NOTICE '  - contacts.email_automations';
    RAISE NOTICE '  - contacts.email_sends';
    RAISE NOTICE '  - contacts.email_suppressions';
    RAISE NOTICE '';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - contacts.email_queue_transactional';
    RAISE NOTICE '  - contacts.email_queue_marketing';
    RAISE NOTICE '';
    RAISE NOTICE 'Kept tables:';
    RAISE NOTICE '  - contacts.email_campaigns (existing)';
    RAISE NOTICE '  - contacts.email_templates';
    RAISE NOTICE '  - contacts.postmark_settings';
    RAISE NOTICE '  - contacts.shared_postmark_config';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run this migration in Supabase';
    RAISE NOTICE '  2. Create Edge Function for processing queues';
    RAISE NOTICE '  3. Update test email button to use queue';
    RAISE NOTICE '  4. Set up UptimeMonitor to trigger every 30 seconds';
    RAISE NOTICE '===========================================';
END $$;