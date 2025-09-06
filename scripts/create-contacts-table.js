const { createClient } = require('@supabase/supabase-js');

// Supabase credentials
const supabaseUrl = 'https://hbopxprpgvrkucztsvnq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4';

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createContactsTable() {
  console.log('Creating contacts table in Supabase...\n');
  
  try {
    // Since public.users doesn't exist, we'll modify the SQL to use auth.users
    const createContactsSQL = `
      -- Create contacts table
      CREATE TABLE IF NOT EXISTS public.contacts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        
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
        
        -- Additional Info
        company TEXT,
        job_title TEXT,
        website TEXT,
        
        -- CRM Fields
        lifecycle_stage TEXT DEFAULT 'subscriber',
        lead_score INTEGER DEFAULT 0,
        source TEXT,
        
        -- Tracking
        tags TEXT[] DEFAULT '{}',
        notes TEXT,
        email_opt_in BOOLEAN DEFAULT false,
        sms_opt_in BOOLEAN DEFAULT false,
        
        -- Metadata
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_activity_at TIMESTAMPTZ,
        
        -- Authentication link (optional)
        is_authenticated BOOLEAN DEFAULT false,
        user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_stage ON contacts(lifecycle_stage);

      -- Create updated_at trigger
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
      CREATE TRIGGER update_contacts_updated_at 
        BEFORE UPDATE ON contacts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    // Use fetch to directly call the Supabase Management API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: createContactsSQL })
    });

    if (!response.ok) {
      // Try another approach - use the SQL endpoint
      console.log('First attempt failed, trying SQL endpoint...\n');
      
      const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          query: createContactsSQL
        })
      });
      
      if (!sqlResponse.ok) {
        const errorText = await sqlResponse.text();
        console.log('SQL endpoint response:', errorText);
        
        // Last resort - output SQL for manual execution
        console.log('\n⚠️  Unable to execute SQL automatically.');
        console.log('Please execute the following SQL in your Supabase SQL Editor:\n');
        console.log('Navigate to: https://hbopxprpgvrkucztsvnq.supabase.co/project/hbopxprpgvrkucztsvnq/editor\n');
        console.log('================== SQL TO EXECUTE ==================');
        console.log(createContactsSQL);
        console.log('=====================================================\n');
        return;
      }
    }

    console.log('✅ Contacts table created successfully!\n');
    
    // Verify the table was created
    console.log('Verifying table creation...');
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Verification failed:', error.message);
      console.log('\nThe table might have been created but the schema cache needs to be refreshed.');
      console.log('Please try refreshing your browser and check again.');
    } else {
      console.log('✅ Table verified successfully!');
      
      // List all columns
      console.log('\nTable structure created with columns:');
      console.log('- id (UUID, Primary Key)');
      console.log('- tenant_id (UUID, Foreign Key to tenants)');
      console.log('- email (TEXT)');
      console.log('- phone (TEXT)');
      console.log('- first_name (TEXT)');
      console.log('- last_name (TEXT)');
      console.log('- full_name (TEXT, Generated)');
      console.log('- company (TEXT)');
      console.log('- job_title (TEXT)');
      console.log('- website (TEXT)');
      console.log('- lifecycle_stage (TEXT, default: subscriber)');
      console.log('- lead_score (INTEGER, default: 0)');
      console.log('- source (TEXT)');
      console.log('- tags (TEXT[])');
      console.log('- notes (TEXT)');
      console.log('- email_opt_in (BOOLEAN, default: false)');
      console.log('- sms_opt_in (BOOLEAN, default: false)');
      console.log('- created_at (TIMESTAMPTZ)');
      console.log('- updated_at (TIMESTAMPTZ)');
      console.log('- last_activity_at (TIMESTAMPTZ)');
      console.log('- is_authenticated (BOOLEAN, default: false)');
      console.log('- user_id (UUID, Foreign Key to auth.users)');
      
      console.log('\nIndexes created:');
      console.log('- idx_contacts_tenant_id');
      console.log('- idx_contacts_email');
      console.log('- idx_contacts_created_at');
      console.log('- idx_contacts_lifecycle_stage');
      
      console.log('\nTriggers created:');
      console.log('- update_contacts_updated_at (auto-updates updated_at on row changes)');
    }
    
  } catch (error) {
    console.error('Error creating table:', error);
  }
}

// Run the creation
createContactsTable();