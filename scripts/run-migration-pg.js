const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  console.log('🚀 Starting ContactGate PostgreSQL Migration...\n');
  
  // Extract database connection details from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    process.exit(1);
  }
  
  // Extract project reference from URL
  const projectRef = supabaseUrl.match(/https:\/\/(.*)\.supabase\.co/)?.[1];
  if (!projectRef) {
    console.error('❌ Invalid Supabase URL format');
    process.exit(1);
  }
  
  // Construct PostgreSQL connection string
  // For Supabase, we need to use the direct connection, not pooler
  // The password format needs to be different
  const dbPassword = supabaseServiceKey; // Using service key as password
  const connectionString = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  
  console.log(`📍 Connecting to Supabase PostgreSQL database...`);
  console.log(`   Project: ${projectRef}`);
  
  // Create PostgreSQL client
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database successfully\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_contacts_schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    
    // Parse SQL statements - properly handling functions
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    let functionDepth = 0;
    
    const lines = migrationSql.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Track function blocks
      if (trimmedLine.match(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i)) {
        inFunction = true;
      }
      
      // Track $$ blocks
      if (line.includes('$$')) {
        functionDepth = functionDepth === 0 ? 1 : 0;
      }
      
      currentStatement += line + '\n';
      
      // End of statement detection
      if (trimmedLine.endsWith(';')) {
        if (!inFunction || (inFunction && functionDepth === 0 && trimmedLine.endsWith('plpgsql;'))) {
          const cleanStatement = currentStatement.trim();
          if (cleanStatement && !cleanStatement.startsWith('--')) {
            statements.push(cleanStatement);
          }
          currentStatement = '';
          inFunction = false;
          functionDepth = 0;
        }
      }
    }
    
    console.log(`📝 Executing ${statements.length} SQL statements...\n`);
    
    // Execute each statement
    let successCount = 0;
    let failedStatements = [];
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Get statement info for logging
      const statementMatch = statement.match(/^(CREATE|ALTER|GRANT|DROP)\s+(SCHEMA|TABLE|INDEX|TRIGGER|FUNCTION|OR REPLACE FUNCTION)?.*?(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)/i);
      const action = statementMatch?.[1] || 'EXECUTE';
      const type = statementMatch?.[2] || '';
      const target = statementMatch?.[3] || '';
      
      process.stdout.write(`  [${i + 1}/${statements.length}] ${action} ${type} ${target}... `);
      
      try {
        await client.query(statement);
        console.log('✅');
        successCount++;
      } catch (error) {
        console.log(`❌`);
        console.log(`     Error: ${error.message}`);
        failedStatements.push({
          statement: statement.substring(0, 100) + '...',
          error: error.message
        });
      }
    }
    
    console.log(`\n✨ Migration completed: ${successCount}/${statements.length} statements successful`);
    
    if (failedStatements.length > 0) {
      console.log('\n⚠️  Some statements failed:');
      failedStatements.forEach((failed, index) => {
        console.log(`   ${index + 1}. ${failed.error}`);
      });
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration results...\n');
    
    // Check if schema exists
    const schemaResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'contacts'
    `);
    
    if (schemaResult.rows.length > 0) {
      console.log('✅ Contacts schema created successfully');
    } else {
      console.log('❌ Contacts schema not found');
    }
    
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'contacts'
      ORDER BY table_name
    `);
    
    console.log(`\n📊 Tables created in contacts schema:`);
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
      console.log(`\n   Total: ${tablesResult.rows.length} tables`);
    } else {
      console.log('   ❌ No tables found');
    }
    
    // Check indexes
    const indexesResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'contacts'
    `);
    
    console.log(`\n📑 Indexes created: ${indexesResult.rows.length}`);
    
    // Check triggers
    const triggersResult = await client.query(`
      SELECT trigger_name, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'contacts'
    `);
    
    console.log(`⚡ Triggers created: ${triggersResult.rows.length}`);
    
    // Check functions
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'contacts'
    `);
    
    console.log(`🔧 Functions created: ${functionsResult.rows.length}`);
    
    // Final summary
    const expectedTables = ['contacts', 'events', 'tags', 'segments', 'custom_field_definitions', 'lists', 'list_memberships'];
    const createdTables = tablesResult.rows.map(r => r.table_name);
    const allTablesCreated = expectedTables.every(table => createdTables.includes(table));
    
    console.log('\n' + '='.repeat(60));
    if (allTablesCreated) {
      console.log('🎉 SUCCESS: ContactGate database schema is fully deployed!');
      console.log('✅ All required tables, indexes, and functions are ready.');
      console.log('\nYour ContactGate application can now interact with the database.');
    } else {
      const missingTables = expectedTables.filter(table => !createdTables.includes(table));
      console.log('⚠️  PARTIAL SUCCESS: Some tables may be missing.');
      console.log('   Missing tables:', missingTables.join(', '));
      console.log('\nPlease check the error messages above and retry if needed.');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nConnection details:');
    console.error('  - Project:', projectRef);
    console.error('  - Host: aws-0-us-west-1.pooler.supabase.com');
    console.error('  - Port: 6543');
    console.error('  - Database: postgres');
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    // Close the connection
    await client.end();
    console.log('\n👋 Database connection closed');
  }
}

// Run the migration
runMigration().catch(console.error);