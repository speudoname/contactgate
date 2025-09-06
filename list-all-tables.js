const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbopxprpgvrkucztsvnq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4';

async function listAllTables() {
  console.log('=== LISTING ALL AVAILABLE TABLES ===\n');

  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };

  // Common table names to check
  const tablesToCheck = [
    'users',
    'tenants',
    'profiles', 
    'contacts',
    'companies',
    'organizations',
    'teams',
    'projects',
    'tasks',
    'documents',
    'files',
    'settings',
    'logs',
    'audit_logs',
    'sessions',
    'permissions',
    'roles',
    'invitations',
    'notifications'
  ];

  console.log('Checking for common table names in public schema:\n');
  
  const existingTables = [];
  
  for (const tableName of tablesToCheck) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?limit=0`, {
      headers: headers,
      method: 'HEAD'
    });
    
    if (response.ok) {
      existingTables.push(tableName);
      console.log(`  ✅ ${tableName} - EXISTS`);
    } else if (response.status === 404) {
      console.log(`  ❌ ${tableName} - NOT FOUND`);
    } else {
      console.log(`  ⚠️  ${tableName} - ERROR (${response.status})`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('\nTables that exist in your database:');
  existingTables.forEach(table => {
    console.log(`  - ${table}`);
  });

  // Now let's get details for existing tables
  console.log('\n=== TABLE DETAILS ===\n');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  for (const table of existingTables) {
    console.log(`${table.toUpperCase()} TABLE:`);
    console.log('-'.repeat(30));
    
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (!error && data && data.length > 0) {
      console.log('Columns:');
      Object.keys(data[0]).forEach(col => {
        const value = data[0][col];
        const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
        console.log(`  - ${col} (${type})`);
      });
    }
    
    // Get count
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total rows: ${count || 0}\n`);
  }
}

listAllTables().then(() => {
  console.log('=== COMPLETE ===');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});