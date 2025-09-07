-- Generate postmark_id for all existing tenants that don't have one
DO $$
DECLARE
    tenant_record RECORD;
    prefix TEXT;
    counter INTEGER;
    new_postmark_id TEXT;
BEGIN
    -- Loop through all tenants without postmark_id
    FOR tenant_record IN 
        SELECT * 
        FROM public.tenants
        WHERE postmark_id IS NULL
        ORDER BY created_at
    LOOP
        -- Generate prefix from tenant name (first 3 letters, uppercase)
        prefix := UPPER(LEFT(REGEXP_REPLACE(COALESCE(tenant_record.name, tenant_record.slug, 'TEN'), '[^A-Za-z]', '', 'g'), 3));
        
        -- If prefix is too short, pad with 'X'
        WHILE LENGTH(prefix) < 3 LOOP
            prefix := prefix || 'X';
        END LOOP;
        
        -- Find the next available number for this prefix
        counter := 1;
        LOOP
            new_postmark_id := prefix || LPAD(counter::TEXT, 3, '0');
            
            -- Check if this ID already exists
            IF NOT EXISTS (
                SELECT 1 FROM public.tenants 
                WHERE postmark_id = new_postmark_id
            ) THEN
                EXIT;
            END IF;
            
            counter := counter + 1;
        END LOOP;
        
        -- Update the tenant with the new postmark_id
        UPDATE public.tenants
        SET postmark_id = new_postmark_id
        WHERE id = tenant_record.id;
        
        -- Also create/update entry in postmark_settings
        INSERT INTO contacts.postmark_settings (
            tenant_id,
            postmark_id,
            server_mode,
            created_at,
            updated_at
        ) VALUES (
            tenant_record.id,
            new_postmark_id,
            'shared', -- Default to shared mode
            NOW(),
            NOW()
        )
        ON CONFLICT (tenant_id) 
        DO UPDATE SET 
            postmark_id = EXCLUDED.postmark_id,
            updated_at = NOW();
        
        RAISE NOTICE 'Generated postmark_id % for tenant %', new_postmark_id, tenant_record.name;
    END LOOP;
END $$;

-- Show the results
SELECT 
    t.id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.postmark_id,
    ps.server_mode,
    ps.created_at as settings_created
FROM public.tenants t
LEFT JOIN contacts.postmark_settings ps ON ps.tenant_id = t.id
ORDER BY t.created_at;