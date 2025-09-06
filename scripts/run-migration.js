const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  console.log('🚀 Starting ContactGate migration...\n');
  
  // Verify environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    process.exit(1);
  }
  
  console.log(`📍 Connecting to Supabase at: ${supabaseUrl}`);
  
  // Create Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_contacts_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📄 Migration file loaded successfully');
  
  try {
    console.log('⚙️  Executing migration via Supabase SQL endpoint...\n');
    
    // Execute the entire migration as a single transaction using the SQL endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        function_name: 'query',
        args: { query: migrationSql }
      })
    });
    
    // Alternative approach: execute the migration directly
    // Since Supabase doesn't have a direct SQL execution endpoint in the JS client,
    // we'll need to use a different approach
    
    // Split SQL into statements carefully
    const statements = [];
    let currentStatement = '';
    let inFunctionBody = false;
    
    const lines = migrationSql.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check if we're starting a function body
      if (trimmedLine.includes('$$') && !inFunctionBody) {
        inFunctionBody = true;
      } else if (trimmedLine.includes('$$') && inFunctionBody) {
        inFunctionBody = false;
      }
      
      currentStatement += line + '\n';
      
      // If we're not in a function body and the line ends with semicolon, it's end of statement
      if (!inFunctionBody && trimmedLine.endsWith(';') && !trimmedLine.startsWith('--')) {
        const cleanStatement = currentStatement.trim();
        if (cleanStatement && !cleanStatement.startsWith('--')) {
          statements.push(cleanStatement);
        }
        currentStatement = '';
      }
    }
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Since we can't execute raw SQL directly through the JS client,
    // let's create a temporary function to execute our SQL
    console.log('Creating temporary migration function...');
    
    const migrationFunctionSql = `
      CREATE OR REPLACE FUNCTION run_contactgate_migration()
      RETURNS void AS $$
      BEGIN
        ${migrationSql.replace(/\$/g, '\\$')}
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // Alternative: Use fetch API to directly call Supabase's SQL endpoint
    const pgRestUrl = `${supabaseUrl}/rest/v1/`;
    
    // Execute statements one by one using a different approach
    let successCount = 0;
    let errors = [];
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Get statement info for logging
      const statementType = statement.match(/^(CREATE|ALTER|GRANT|INSERT|UPDATE|DELETE|DROP)/i)?.[1] || 'EXECUTE';
      const targetMatch = statement.match(/(SCHEMA|TABLE|INDEX|TRIGGER|FUNCTION)\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/i);
      const target = targetMatch ? targetMatch[2] : '';
      
      process.stdout.write(`  [${i + 1}/${statements.length}] ${statementType} ${target}... `);
      
      // For now, we'll skip actual execution and just simulate
      // In a real scenario, you would need to use Supabase CLI or connect directly to PostgreSQL
      console.log('✅ (simulated)');
      successCount++;
    }
    
    console.log(`\n✨ Prepared ${successCount}/${statements.length} statements`);
    console.log('\n⚠️  Note: Direct SQL execution through Supabase JS client is limited.');
    console.log('    For full migration, use one of these methods:\n');
    console.log('    1. Run the SQL directly in Supabase Dashboard SQL Editor:');
    console.log(`       ${supabaseUrl.replace('.supabase.co', '.supabase.com')}/project/hbopxprpgvrkucztsvnq/sql/new\n`);
    console.log('    2. Use Supabase CLI:');
    console.log('       supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.hbopxprpgvrkucztsvnq.supabase.co:5432/postgres"\n');
    console.log('    3. Use psql directly:');
    console.log('       psql "postgresql://postgres:[YOUR-PASSWORD]@db.hbopxprpgvrkucztsvnq.supabase.co:5432/postgres" < supabase/migrations/001_create_contacts_schema.sql\n');
    
    // Let's try to verify if tables already exist
    console.log('🔍 Checking current database state...\n');
    
    const tablesToCheck = [
      { schema: 'contacts', table: 'contacts' },
      { schema: 'contacts', table: 'events' },
      { schema: 'contacts', table: 'tags' },
      { schema: 'contacts', table: 'segments' },
      { schema: 'contacts', table: 'custom_field_definitions' },
      { schema: 'contacts', table: 'lists' },
      { schema: 'contacts', table: 'list_memberships' }
    ];
    
    let existingTables = 0;
    for (const { schema, table } of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(`${schema}.${table}`)
          .select('*')
          .limit(0);
        
        if (!error) {
          console.log(`  ✅ Table ${schema}.${table} exists`);
          existingTables++;
        } else {
          console.log(`  ❌ Table ${schema}.${table} not found`);
        }
      } catch (e) {
        console.log(`  ❌ Table ${schema}.${table} not found`);
      }
    }
    
    if (existingTables === tablesToCheck.length) {
      console.log('\n🎉 All tables already exist! Migration may have been run previously.');
    } else if (existingTables > 0) {
      console.log(`\n⚠️  ${existingTables}/${tablesToCheck.length} tables exist. Partial migration detected.`);
    } else {
      console.log('\n⚠️  No ContactGate tables found. Please run the migration using one of the methods above.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration().catch(console.error);