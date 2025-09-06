const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbopxprpgvrkucztsvnq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchemas() {
  console.log('=== CHECKING DATABASE SCHEMAS ===\n');

  try {
    // Query 1: List ALL schemas in the database
    console.log('1. ALL SCHEMAS IN DATABASE:');
    console.log('============================');
    
    const { data: schemas, error: schemaError } = await supabase.rpc('get_schemas', {}, {
      head: false,
      count: null
    }).single();

    // If the RPC doesn't exist, use direct SQL query
    const schemasQuery = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name;
    `;
    
    const { data: schemasData, error: schemasError } = await supabase
      .rpc('sql_query', { query: schemasQuery })
      .single();

    if (schemasError) {
      // Try another approach - query pg_namespace directly
      const { data: rawSchemas, error: rawError } = await supabase
        .from('pg_namespace')
        .select('nspname')
        .not('nspname', 'like', 'pg_%')
        .neq('nspname', 'information_schema');

      if (rawError) {
        console.log('Using fallback method to list schemas...\n');
        
        // Use a different approach with direct REST API call
        const headers = {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        };

        // Execute raw SQL via REST API
        const sqlQuery = {
          query: `
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
            ORDER BY schema_name;
          `
        };

        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(sqlQuery)
        });

        if (!response.ok) {
          console.log('Note: Unable to query schemas directly. Will check specific schemas...\n');
          
          // Check for specific schemas we're interested in
          const schemasToCheck = ['public', 'contacts', 'auth', 'storage', 'realtime', 'vault', 'extensions'];
          
          for (const schema of schemasToCheck) {
            console.log(`Checking schema: ${schema}`);
          }
        } else {
          const result = await response.json();
          console.log('Schemas found:', result);
        }
      } else {
        console.log('Schemas found:');
        rawSchemas.forEach(s => console.log(`  - ${s.nspname}`));
      }
    } else {
      console.log('Schemas found:', schemasData);
    }

    // Query 2: Check if 'contacts' schema exists specifically
    console.log('\n2. CHECKING FOR CONTACTS SCHEMA:');
    console.log('=================================');
    
    const contactsSchemaQuery = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'contacts';
    `;

    // Query 3: List tables in public schema
    console.log('\n3. TABLES IN PUBLIC SCHEMA:');
    console.log('============================');
    
    const publicTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    // Try to get tables from public schema
    const { data: publicTables, error: publicError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (publicError) {
      // Fallback: List known tables
      console.log('Checking known tables in public schema...\n');
      
      const knownTables = [
        'contacts',
        'companies', 
        'users',
        'tenants',
        'profiles',
        'organizations'
      ];

      for (const table of knownTables) {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(0);
        
        if (!error) {
          console.log(`  ✅ ${table}`);
        }
      }
    } else {
      publicTables.forEach(t => console.log(`  - ${t.table_name}`));
    }

    // Query 4: If contacts schema exists, list its tables
    console.log('\n4. CHECKING TABLES IN CONTACTS SCHEMA (if exists):');
    console.log('==================================================');
    
    // Try to access tables with contacts schema prefix
    const contactsTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'contacts' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    // Try to query contacts.* tables
    const possibleContactsTables = ['contacts', 'companies', 'organizations', 'people'];
    
    console.log('Attempting to access contacts schema tables:');
    for (const table of possibleContactsTables) {
      try {
        // Try with schema prefix
        const { error } = await supabase
          .from(`contacts.${table}`)
          .select('*')
          .limit(0);
        
        if (!error) {
          console.log(`  ✅ contacts.${table} - EXISTS`);
        } else {
          console.log(`  ❌ contacts.${table} - ${error.message}`);
        }
      } catch (e) {
        console.log(`  ❌ contacts.${table} - Not accessible`);
      }
    }

    // Query 5: Show current search_path
    console.log('\n5. DATABASE SEARCH PATH:');
    console.log('========================');
    
    const searchPathQuery = `SHOW search_path;`;
    
    // Note: This might not work directly, but we can try
    console.log('Default search_path is typically: "$user", public');
    
    // Additional info about the contacts table in public schema
    console.log('\n6. CONTACTS TABLE DETAILS (if in public schema):');
    console.log('================================================');
    
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(1);
    
    if (!contactsError) {
      console.log('✅ Contacts table found in PUBLIC schema');
      
      // Get column information
      if (contactsData && contactsData.length > 0) {
        console.log('\nColumns in contacts table:');
        Object.keys(contactsData[0]).forEach(col => {
          const value = contactsData[0][col];
          const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
          console.log(`  - ${col} (${type})`);
        });
      }
      
      // Get row count
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });
      
      console.log(`\nTotal rows in contacts table: ${count || 0}`);
    } else {
      console.log('❌ No contacts table in public schema or access denied');
      console.log(`Error: ${contactsError.message}`);
    }

  } catch (error) {
    console.error('Error checking schemas:', error);
  }
}

// Run the check
checkSchemas().then(() => {
  console.log('\n=== SCHEMA CHECK COMPLETE ===');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});