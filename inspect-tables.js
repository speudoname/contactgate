const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbopxprpgvrkucztsvnq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTables() {
  console.log('=== DETAILED TABLE INSPECTION ===\n');

  try {
    // 1. Inspect contacts table structure
    console.log('1. CONTACTS TABLE STRUCTURE:');
    console.log('-----------------------------');
    
    // Get sample data to understand structure
    const { data: contactsSample, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(1);
    
    if (contactsError) {
      console.log('  Error fetching contacts:', contactsError.message);
    } else if (contactsSample && contactsSample.length > 0) {
      console.log('  Sample record columns:');
      Object.keys(contactsSample[0]).forEach(key => {
        const value = contactsSample[0][key];
        const type = value === null ? 'null' : typeof value;
        console.log(`    - ${key}: ${type} (sample: ${JSON.stringify(value)?.substring(0, 50)}...)`);
      });
      
      // Get total count
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });
      console.log(`\n  Total records: ${count}`);
    } else {
      console.log('  Table exists but is empty');
      
      // Try to get columns even if empty
      const { data: emptySelect, error: emptyError } = await supabase
        .from('contacts')
        .select('*')
        .limit(0);
      
      if (!emptyError && emptySelect) {
        console.log('  Table is ready for data insertion');
      }
    }

    // 2. Inspect users table structure
    console.log('\n2. USERS TABLE STRUCTURE:');
    console.log('--------------------------');
    
    const { data: usersSample, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (usersError) {
      console.log('  Error fetching users:', usersError.message);
    } else if (usersSample && usersSample.length > 0) {
      console.log('  Sample record columns:');
      Object.keys(usersSample[0]).forEach(key => {
        const value = usersSample[0][key];
        const type = value === null ? 'null' : typeof value;
        console.log(`    - ${key}: ${type}`);
      });
      
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      console.log(`\n  Total records: ${count}`);
    } else {
      console.log('  Table exists but is empty');
    }

    // 3. Inspect profiles table structure
    console.log('\n3. PROFILES TABLE STRUCTURE:');
    console.log('-----------------------------');
    
    const { data: profilesSample, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.log('  Error fetching profiles:', profilesError.message);
    } else if (profilesSample && profilesSample.length > 0) {
      console.log('  Sample record columns:');
      Object.keys(profilesSample[0]).forEach(key => {
        const value = profilesSample[0][key];
        const type = value === null ? 'null' : typeof value;
        console.log(`    - ${key}: ${type}`);
      });
      
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      console.log(`\n  Total records: ${count}`);
    } else {
      console.log('  Table exists but is empty');
    }

    // 4. Try to get RLS policies for contacts table
    console.log('\n4. CONTACTS TABLE RLS POLICIES:');
    console.log('---------------------------------');
    
    const { data: policies, error: policiesError } = await supabase.rpc('get_policies_for_table', {
      table_name: 'contacts'
    });
    
    if (policiesError) {
      console.log('  Could not fetch RLS policies directly');
      
      // Check if RLS is enabled
      const { data: rlsCheck, error: rlsError } = await supabase.rpc('check_rls_enabled', {
        table_name: 'contacts'
      });
      
      if (rlsError) {
        console.log('  Unable to check RLS status');
      } else {
        console.log(`  RLS enabled: ${rlsCheck}`);
      }
    } else if (policies) {
      policies.forEach(p => console.log(`  - ${p.policy_name}: ${p.command}`));
    }

    // 5. Test inserting a contact
    console.log('\n5. TESTING CONTACTS TABLE OPERATIONS:');
    console.log('---------------------------------------');
    
    // First, let's see if we can insert
    const testContact = {
      name: 'Test Contact',
      email: 'test@example.com',
      phone: '+1234567890',
      created_at: new Date().toISOString()
    };
    
    console.log('  Attempting to insert test contact...');
    const { data: insertData, error: insertError } = await supabase
      .from('contacts')
      .insert([testContact])
      .select();
    
    if (insertError) {
      console.log(`  ❌ Insert failed: ${insertError.message}`);
      console.log('     This might indicate missing columns or constraints');
    } else {
      console.log(`  ✅ Insert successful!`);
      if (insertData && insertData[0]) {
        console.log('     Inserted record:');
        Object.keys(insertData[0]).forEach(key => {
          console.log(`       - ${key}: ${insertData[0][key]}`);
        });
        
        // Clean up test data
        const { error: deleteError } = await supabase
          .from('contacts')
          .delete()
          .eq('id', insertData[0].id);
        
        if (!deleteError) {
          console.log('     Test data cleaned up');
        }
      }
    }

    // 6. Check storage buckets
    console.log('\n6. STORAGE BUCKETS:');
    console.log('--------------------');
    
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
    
    if (bucketsError) {
      console.log('  Error fetching buckets:', bucketsError.message);
    } else if (buckets && buckets.length > 0) {
      buckets.forEach(b => {
        console.log(`  - ${b.name} (public: ${b.public}, created: ${b.created_at})`);
      });
    } else {
      console.log('  No storage buckets found');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the inspection
inspectTables().then(() => {
  console.log('\n=== TABLE INSPECTION COMPLETE ===');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});