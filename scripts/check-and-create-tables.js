const { createClient } = require('@supabase/supabase-js');

// Supabase credentials
const supabaseUrl = 'https://hbopxprpgvrkucztsvnq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4';

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndCreateTables() {
  console.log('Connecting to Supabase...');
  
  try {
    // Check if tenants table exists
    console.log('\n1. Checking for tenants table...');
    const { data: tenantsCheck, error: tenantsCheckError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1);
    
    if (tenantsCheckError) {
      if (tenantsCheckError.message.includes('does not exist') || tenantsCheckError.message.includes('not found')) {
        console.log('   ❌ Tenants table does not exist');
        console.log('   Creating tenants table...');
        
        // Create tenants table first
        const createTenantsSQL = `
          CREATE TABLE IF NOT EXISTS public.tenants (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
        `;
        
        const { error: createTenantsError } = await supabase.rpc('exec_sql', {
          sql: createTenantsSQL
        }).single();
        
        if (createTenantsError) {
          // Try direct SQL execution
          const { data, error } = await supabase.rpc('query', { query: createTenantsSQL });
          if (error) {
            console.log('   ❌ Failed to create tenants table:', error.message);
          } else {
            console.log('   ✅ Tenants table created successfully');
          }
        } else {
          console.log('   ✅ Tenants table created successfully');
        }
      } else {
        throw tenantsCheckError;
      }
    } else {
      console.log('   ✅ Tenants table exists');
    }
    
    // Check if users table exists (for user_id reference)
    console.log('\n2. Checking for users table...');
    const { data: usersCheck, error: usersCheckError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersCheckError) {
      if (usersCheckError.message.includes('does not exist') || usersCheckError.message.includes('not found')) {
        console.log('   ❌ Users table does not exist');
        console.log('   Note: This is the auth.users table, which should exist in Supabase by default');
        console.log('   We\'ll modify the contacts table to reference auth.users instead');
      }
    } else {
      console.log('   ✅ Users table exists');
    }
    
    // Check if contacts table exists
    console.log('\n3. Checking for contacts table...');
    const { data: contactsCheck, error: contactsCheckError } = await supabase
      .from('contacts')
      .select('id')
      .limit(1);
    
    if (contactsCheckError) {
      if (contactsCheckError.message.includes('does not exist') || contactsCheckError.message.includes('not found')) {
        console.log('   ❌ Contacts table does not exist');
        console.log('   Creating contacts table...');
        
        // Read the SQL file content and modify it to use auth.users
        const fs = require('fs');
        let createContactsSQL = fs.readFileSync('/Users/apple/komunate/contactgate/scripts/setup-contacts-table.sql', 'utf8');
        
        // Replace public.users with auth.users
        createContactsSQL = createContactsSQL.replace('REFERENCES public.users(id)', 'REFERENCES auth.users(id)');
        
        // Execute the SQL directly using raw SQL
        console.log('   Executing SQL to create contacts table...');
        
        // We'll need to use the Supabase SQL Editor API or connect directly
        // For now, let's output the SQL that needs to be executed
        console.log('\n   SQL to execute in Supabase SQL Editor:');
        console.log('   =====================================');
        console.log(createContactsSQL);
        console.log('   =====================================');
        
        console.log('\n   ⚠️  Please execute the above SQL in your Supabase SQL Editor');
        console.log('   Navigate to: https://hbopxprpgvrkucztsvnq.supabase.co/project/hbopxprpgvrkucztsvnq/editor');
        
      } else {
        throw contactsCheckError;
      }
    } else {
      console.log('   ✅ Contacts table exists');
      
      // Get table structure
      const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
        table_name: 'contacts'
      });
      
      if (!columnsError && columns) {
        console.log('   Table columns:', columns.map(c => c.column_name).join(', '));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the check
checkAndCreateTables();