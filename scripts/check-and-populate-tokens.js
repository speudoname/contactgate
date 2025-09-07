const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndPopulateTokens() {
  console.log('🔍 Checking current token status...\n');
  
  // Get all postmark settings from contacts schema
  const { data: settings, error: settingsError } = await supabase
    .schema('contacts')
    .from('postmark_settings')
    .select('*');

  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
    return;
  }

  console.log(`Found ${settings?.length || 0} tenant configurations\n`);
  
  // Check each tenant's token status
  for (const setting of settings || []) {
    // Get tenant name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, postmark_id')
      .eq('id', setting.tenant_id)
      .single();
    
    console.log(`Tenant: ${tenant?.name || 'Unknown'} (${tenant?.postmark_id || 'No ID'})`);
    console.log(`  Mode: ${setting.server_mode}`);
    console.log(`  Shared Token: ${setting.shared_server_token ? '✅' : '❌'}`);
    console.log(`  Transactional Token: ${setting.dedicated_transactional_token ? '✅' : '❌'}`);
    console.log(`  Marketing Token: ${setting.dedicated_marketing_token ? '✅' : '❌'}`);
    console.log('---');
  }

  console.log('\n📝 Populating missing tokens...\n');

  // Update shared server config first
  const { error: sharedError } = await supabase
    .schema('contacts')
    .from('shared_postmark_config')
    .upsert({
      server_name: 'defaultsharednumagte',
      server_token: '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
      transactional_stream: 'outbound',
      marketing_stream: 'broadcast',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'server_name'
    });

  if (sharedError) {
    console.error('Error updating shared config:', sharedError);
  } else {
    console.log('✅ Updated shared server config');
  }

  // Update all tenants using shared mode
  const { error: updateSharedError } = await supabase
    .schema('contacts')
    .from('postmark_settings')
    .update({
      shared_server_token: '59cf1ddb-d888-43b8-9d6d-a56879df5bd6',
      updated_at: new Date().toISOString()
    })
    .eq('server_mode', 'shared');

  if (updateSharedError) {
    console.error('Error updating shared tokens:', updateSharedError);
  } else {
    console.log('✅ Updated shared mode tenants with default token');
  }

  // Token mapping for specific tenants
  const tokenMappings = {
    'MUS001': 'fec0c42d-3701-463c-8f26-71545147be7e',
    'AIX001': '8e9d16a7-bb09-4fc0-8509-de30207de037',
    'Vibenar': 'a99437c1-ce0c-4c50-800a-310c7257701a'
  };

  // Update specific tenant tokens
  for (const [postmarkId, token] of Object.entries(tokenMappings)) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .or(`postmark_id.eq.${postmarkId},name.eq.${postmarkId}`)
      .single();

    if (tenant) {
      const { error } = await supabase
        .schema('contacts')
        .from('postmark_settings')
        .update({
          dedicated_transactional_token: token,
          dedicated_marketing_token: token,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenant.id);

      if (!error) {
        console.log(`✅ Updated tokens for ${postmarkId}`);
      }
    }
  }

  console.log('\n✅ Token population complete!\n');
  
  // Show final status
  const { data: finalSettings } = await supabase
    .schema('contacts')
    .from('postmark_settings')
    .select('*');

  console.log('Final Status:');
  for (const setting of finalSettings || []) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', setting.tenant_id)
      .single();
    
    const hasTokens = (setting.server_mode === 'shared' && setting.shared_server_token) ||
                     (setting.server_mode === 'dedicated' && 
                      (setting.dedicated_transactional_token || setting.dedicated_marketing_token));
    
    console.log(`  ${tenant?.name || 'Unknown'}: ${hasTokens ? '✅ Has tokens' : '❌ Missing tokens'}`);
  }
}

checkAndPopulateTokens().catch(console.error);