const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbopxprpgvrkucztsvnq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function exploreDatabaseStructure() {
  console.log('=== CONNECTING TO SUPABASE DATABASE ===\n');

  try {
    // 1. Get all schemas
    console.log('1. LISTING ALL SCHEMAS:');
    console.log('------------------------');
    const { data: schemas, error: schemaError } = await supabase
      .rpc('get_schemas', {}, { 
        get: true,
        head: false,
        count: null
      })
      .select('*');

    if (schemaError) {
      // Try alternative query for schemas
      const { data: altSchemas, error: altError } = await supabase
        .from('information_schema.schemata')
        .select('schema_name')
        .order('schema_name');
      
      if (altError) {
        // Use direct SQL query
        const { data: sqlSchemas, error: sqlError } = await supabase.rpc('get_database_info');
        
        if (sqlError) {
          console.log('Could not list schemas directly. Will check known schemas...');
        } else {
          console.log(sqlSchemas);
        }
      } else {
        altSchemas?.forEach(s => console.log(`  - ${s.schema_name}`));
      }
    } else {
      schemas?.forEach(s => console.log(`  - ${s}`));
    }

    // 2. Get tables from public schema
    console.log('\n2. TABLES IN PUBLIC SCHEMA:');
    console.log('----------------------------');
    const { data: publicTables, error: publicError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .order('table_name');

    if (publicError) {
      // Try alternative approach - list using direct query
      const { data: tables } = await supabase.rpc('get_public_tables');
      if (tables) {
        tables.forEach(t => console.log(`  - ${t.table_name} (${t.table_type})`));
      } else {
        console.log('  Error fetching public tables:', publicError.message);
      }
    } else {
      if (publicTables && publicTables.length > 0) {
        publicTables.forEach(t => console.log(`  - ${t.table_name} (${t.table_type})`));
      } else {
        console.log('  No tables found in public schema');
      }
    }

    // 3. Check for contacts schema
    console.log('\n3. CHECKING FOR CONTACTS SCHEMA:');
    console.log('----------------------------------');
    const { data: contactsSchema, error: contactsSchemaError } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .eq('schema_name', 'contacts')
      .single();

    if (contactsSchemaError || !contactsSchema) {
      console.log('  No "contacts" schema found');
    } else {
      console.log('  "contacts" schema EXISTS!');
      
      // Get tables from contacts schema
      console.log('\n4. TABLES IN CONTACTS SCHEMA:');
      console.log('-------------------------------');
      const { data: contactsTables, error: contactsTablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name, table_type')
        .eq('table_schema', 'contacts')
        .order('table_name');

      if (contactsTablesError) {
        console.log('  Error fetching contacts schema tables:', contactsTablesError.message);
      } else if (contactsTables && contactsTables.length > 0) {
        contactsTables.forEach(t => console.log(`  - ${t.table_name} (${t.table_type})`));
      } else {
        console.log('  No tables found in contacts schema');
      }
    }

    // 4. Check specifically for a contacts table in public schema
    console.log('\n5. CHECKING FOR CONTACTS TABLE IN PUBLIC SCHEMA:');
    console.log('--------------------------------------------------');
    const { data: contactsTable, error: contactsTableError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'contacts')
      .single();

    if (contactsTableError || !contactsTable) {
      console.log('  No "contacts" table found in public schema');
    } else {
      console.log('  "contacts" table EXISTS in public schema!');
      
      // Get column info for contacts table
      console.log('\n  Columns in public.contacts:');
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', 'contacts')
        .order('ordinal_position');

      if (columnsError) {
        console.log('    Error fetching columns:', columnsError.message);
      } else if (columns) {
        columns.forEach(c => {
          console.log(`    - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`);
        });
      }
    }

    // 5. Let's try a simpler approach - just query tables directly
    console.log('\n6. ATTEMPTING DIRECT TABLE ACCESS:');
    console.log('------------------------------------');
    
    // Try to query contacts table directly
    console.log('  Trying to query "contacts" table...');
    const { data: contactsData, error: contactsDataError, count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    if (contactsDataError) {
      console.log(`  ❌ Cannot access "contacts" table: ${contactsDataError.message}`);
    } else {
      console.log(`  ✅ "contacts" table is accessible! Row count: ${count}`);
    }

    // 6. Get all accessible tables using a different approach
    console.log('\n7. LISTING ALL ACCESSIBLE TABLES:');
    console.log('-----------------------------------');
    
    // This query should work with service role key
    const { data: allTables, error: allTablesError } = await supabase.rpc('get_all_tables');
    
    if (allTablesError) {
      // Try raw SQL through RPC if you have a function for it
      console.log('  Using alternative method to list tables...');
      
      // List some common Supabase tables we can check
      const tablesToCheck = [
        'contacts',
        'users',
        'profiles',
        'auth.users',
        'storage.buckets',
        'storage.objects'
      ];
      
      for (const table of tablesToCheck) {
        try {
          const { error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            console.log(`  ✅ ${table} - exists and accessible`);
          }
        } catch (e) {
          // Table doesn't exist or not accessible
        }
      }
    } else if (allTables) {
      allTables.forEach(t => console.log(`  - ${t.schema_name}.${t.table_name}`));
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the exploration
exploreDatabaseStructure().then(() => {
  console.log('\n=== DATABASE EXPLORATION COMPLETE ===');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});