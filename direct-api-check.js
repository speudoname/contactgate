const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbopxprpgvrkucztsvnq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4';

async function checkDatabaseDirectly() {
  console.log('=== DIRECT API DATABASE CHECK ===\n');

  // Make direct API calls
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // 1. Try to fetch from contacts table using REST API
    console.log('1. CHECKING CONTACTS TABLE VIA REST API:');
    console.log('-----------------------------------------');
    
    const contactsResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?limit=1`, {
      headers: headers
    });
    
    if (contactsResponse.ok) {
      const data = await contactsResponse.json();
      console.log('  ✅ Contacts table exists!');
      if (data.length > 0) {
        console.log('  Sample record:');
        console.log(JSON.stringify(data[0], null, 2));
      } else {
        console.log('  Table is empty');
      }
    } else {
      console.log(`  ❌ Error: ${contactsResponse.status} - ${contactsResponse.statusText}`);
      const errorText = await contactsResponse.text();
      console.log(`     ${errorText}`);
    }

    // 2. Check users table
    console.log('\n2. CHECKING USERS TABLE VIA REST API:');
    console.log('--------------------------------------');
    
    const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users?limit=1`, {
      headers: headers
    });
    
    if (usersResponse.ok) {
      const data = await usersResponse.json();
      console.log('  ✅ Users table exists!');
      if (data.length > 0) {
        console.log('  Columns found:');
        Object.keys(data[0]).forEach(key => {
          console.log(`    - ${key}`);
        });
      }
    } else {
      console.log(`  ❌ Error: ${usersResponse.status} - ${usersResponse.statusText}`);
    }

    // 3. Try using the Supabase client with different initialization
    console.log('\n3. USING SUPABASE CLIENT WITH SCHEMA OPTION:');
    console.log('---------------------------------------------');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    // Try contacts table
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(1);
    
    if (contactsError) {
      console.log(`  Contacts error: ${contactsError.message}`);
    } else {
      console.log('  ✅ Contacts table accessible via client!');
      if (contactsData && contactsData.length > 0) {
        console.log('  Columns:');
        Object.keys(contactsData[0]).forEach(key => {
          console.log(`    - ${key}`);
        });
      }
    }

    // 4. Try to get table definitions using SQL
    console.log('\n4. TRYING SQL QUERY FOR TABLE INFO:');
    console.log('------------------------------------');
    
    // Create a function to get table info if it doesn't exist
    const { error: funcError } = await supabase.rpc('get_table_info', {
      schema_name: 'public',
      table_name: 'contacts'
    }).single();
    
    if (funcError) {
      console.log('  RPC function not available, trying raw SQL...');
      
      // Try to execute raw SQL
      const { data: sqlData, error: sqlError } = await supabase
        .from('pg_catalog.pg_tables')
        .select('*')
        .eq('schemaname', 'public');
      
      if (sqlError) {
        console.log(`  SQL error: ${sqlError.message}`);
      } else if (sqlData) {
        console.log('  Tables found in public schema:');
        sqlData.forEach(t => console.log(`    - ${t.tablename}`));
      }
    }

    // 5. Check if we need to create the contacts table
    console.log('\n5. ATTEMPTING TO CREATE CONTACTS TABLE:');
    console.log('----------------------------------------');
    
    // Try to create the table using SQL via RPC
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.contacts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID REFERENCES users(tenant_id),
        user_id UUID REFERENCES users(id),
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        position TEXT,
        notes TEXT,
        tags TEXT[],
        custom_fields JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `;
    
    console.log('  SQL to create contacts table prepared');
    console.log('  Note: This needs to be run via Supabase SQL editor or migration');

  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabaseDirectly().then(() => {
  console.log('\n=== DIRECT API CHECK COMPLETE ===');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});