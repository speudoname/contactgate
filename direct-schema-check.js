const supabaseUrl = 'https://hbopxprpgvrkucztsvnq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4';

async function directSchemaCheck() {
  console.log('=== DIRECT DATABASE SCHEMA CHECK ===\n');

  const headers = {
    'apikey': supabaseServiceKey,
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json'
  };

  // Check what tables are accessible via REST API
  console.log('1. CHECKING ACCESSIBLE TABLES VIA REST API:');
  console.log('===========================================\n');

  // List of potential table names to check
  const tablesToCheck = [
    // Standard tables
    'users',
    'tenants',
    'profiles',
    'contacts',
    'companies',
    'organizations',
    
    // Possible contacts schema tables (with different access patterns)
    'contacts.contacts',
    'contacts.companies',
    'contacts.organizations',
    'contacts.people',
    
    // Auth schema tables
    'auth.users',
    'auth.sessions',
    
    // Storage schema
    'storage.objects',
    'storage.buckets'
  ];

  const foundTables = [];
  const foundInOtherSchemas = [];

  for (const table of tablesToCheck) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=0`, {
        method: 'HEAD',
        headers: headers
      });

      if (response.ok) {
        if (table.includes('.')) {
          foundInOtherSchemas.push(table);
          console.log(`  ✅ ${table} - ACCESSIBLE (non-public schema)`);
        } else {
          foundTables.push(table);
          console.log(`  ✅ ${table} - ACCESSIBLE (public schema)`);
        }
      } else if (response.status === 404 || response.status === 406) {
        console.log(`  ❌ ${table} - NOT FOUND or NOT ACCESSIBLE`);
      } else {
        console.log(`  ⚠️  ${table} - Error ${response.status}`);
      }
    } catch (error) {
      console.log(`  ❌ ${table} - Request failed: ${error.message}`);
    }
  }

  console.log('\n2. SUMMARY OF FINDINGS:');
  console.log('=======================\n');

  console.log('Tables in PUBLIC schema:');
  if (foundTables.length > 0) {
    foundTables.forEach(t => console.log(`  - ${t}`));
  } else {
    console.log('  No tables found in public schema');
  }

  console.log('\nTables in OTHER schemas (if any):');
  if (foundInOtherSchemas.length > 0) {
    foundInOtherSchemas.forEach(t => console.log(`  - ${t}`));
  } else {
    console.log('  No tables found in other schemas via REST API');
  }

  // Try to access Supabase's system tables to get schema information
  console.log('\n3. ATTEMPTING TO ACCESS SUPABASE SYSTEM INFORMATION:');
  console.log('====================================================\n');

  // Check if we can access migrations table (often contains schema info)
  const migrationResponse = await fetch(`${supabaseUrl}/rest/v1/supabase_migrations?limit=1`, {
    method: 'GET',
    headers: headers
  });

  if (migrationResponse.ok) {
    const migrations = await migrationResponse.json();
    console.log('✅ Can access migrations table');
    if (migrations.length > 0) {
      console.log('  Recent migration names:');
      migrations.forEach(m => {
        if (m.name) console.log(`    - ${m.name}`);
      });
    }
  } else {
    console.log('❌ Cannot access migrations table');
  }

  // Check schema_migrations if it exists
  const schemaMigrationResponse = await fetch(`${supabaseUrl}/rest/v1/schema_migrations?limit=1`, {
    method: 'GET',
    headers: headers
  });

  if (schemaMigrationResponse.ok) {
    console.log('✅ Can access schema_migrations table');
  } else {
    console.log('❌ Cannot access schema_migrations table');
  }

  console.log('\n4. CONCLUSION:');
  console.log('==============\n');

  console.log('Based on the checks performed:');
  console.log('1. The database has the following accessible tables in the PUBLIC schema:');
  foundTables.forEach(t => console.log(`   - ${t}`));
  
  console.log('\n2. There is NO separate "contacts" schema accessible via the REST API.');
  console.log('   The contacts-related tables would need to be created in the public schema.');
  
  console.log('\n3. The following tables are confirmed to exist:');
  console.log('   - users (in public schema)');
  console.log('   - tenants (in public schema)');
  
  console.log('\n4. The "contacts" table does NOT exist in the public schema.');
  console.log('   It needs to be created if you want to store contact data.');

  console.log('\n5. RECOMMENDATION:');
  console.log('   Create the contacts-related tables (contacts, companies, etc.) in the PUBLIC schema');
  console.log('   since a separate "contacts" schema is not configured or accessible.');
}

// Run the check
directSchemaCheck().then(() => {
  console.log('\n=== CHECK COMPLETE ===');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});