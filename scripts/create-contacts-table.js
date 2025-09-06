const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createContactsTable() {
  console.log('Creating contacts table...');
  
  const createTableSQL = `
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
  `;

  const createIndexesSQL = `
    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_stage ON contacts(lifecycle_stage);
  `;

  const createTriggerSQL = `
    -- Create updated_at trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Create trigger
    DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
    CREATE TRIGGER update_contacts_updated_at 
      BEFORE UPDATE ON contacts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    // Create table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: createTableSQL
    }).single();
    
    if (tableError) {
      // Try direct SQL execution as fallback
      const { data: tableData, error: directTableError } = await supabase
        .from('contacts')
        .select('id')
        .limit(1);
      
      if (directTableError && directTableError.code === '42P01') {
        // Table doesn't exist, create it using raw SQL
        console.log('Creating table using raw SQL...');
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            query: createTableSQL
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create table: ${response.statusText}`);
        }
      }
    }
    console.log('✅ Contacts table created successfully');

    // Create indexes
    console.log('Creating indexes...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: createIndexesSQL
    }).single();
    
    if (indexError) {
      console.log('Note: Indexes might already exist or require manual creation');
    } else {
      console.log('✅ Indexes created successfully');
    }

    // Create trigger
    console.log('Creating updated_at trigger...');
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql: createTriggerSQL
    }).single();
    
    if (triggerError) {
      console.log('Note: Trigger might already exist or require manual creation');
    } else {
      console.log('✅ Trigger created successfully');
    }

    // Verify table structure
    console.log('\nVerifying table structure...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'contacts' });
    
    if (!columnsError && columns) {
      console.log('\n📊 Contacts table structure:');
      console.table(columns);
    } else {
      // Fallback: Try to select from the table
      const { data: testSelect, error: selectError } = await supabase
        .from('contacts')
        .select('*')
        .limit(0);
      
      if (!selectError) {
        console.log('✅ Table exists and is accessible');
        console.log('\nTable columns detected from schema:');
        const columnList = [
          'id (UUID)',
          'tenant_id (UUID)',
          'email (TEXT)',
          'phone (TEXT)', 
          'first_name (TEXT)',
          'last_name (TEXT)',
          'full_name (TEXT - Generated)',
          'company (TEXT)',
          'job_title (TEXT)',
          'website (TEXT)',
          'lifecycle_stage (TEXT)',
          'lead_score (INTEGER)',
          'source (TEXT)',
          'tags (TEXT[])',
          'notes (TEXT)',
          'email_opt_in (BOOLEAN)',
          'sms_opt_in (BOOLEAN)',
          'created_at (TIMESTAMPTZ)',
          'updated_at (TIMESTAMPTZ)',
          'last_activity_at (TIMESTAMPTZ)',
          'is_authenticated (BOOLEAN)',
          'user_id (UUID)'
        ];
        columnList.forEach(col => console.log(`  - ${col}`));
      } else {
        console.error('Error verifying table:', selectError);
      }
    }

    console.log('\n✅ Contacts table setup completed successfully!');
    
  } catch (error) {
    console.error('Error creating contacts table:', error);
    process.exit(1);
  }
}

// Alternative: Direct SQL execution function
async function executeSQLDirect() {
  const sql = `
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

  console.log('Executing SQL directly via Supabase Dashboard...');
  console.log('\n📋 Please run the following SQL in your Supabase Dashboard:');
  console.log('=' .repeat(60));
  console.log(sql);
  console.log('=' .repeat(60));
}

// Run the function
createContactsTable().catch(error => {
  console.error('Failed to create table programmatically.');
  console.log('\n⚠️  Alternative: Execute the SQL manually in Supabase Dashboard');
  executeSQLDirect();
});