const fetch = require('node-fetch');
require('dotenv').config({ path: '../numgate/.env.local' });

const POSTMARK_ACCOUNT_TOKEN = process.env.POSTMARK_ACCOUNT_TOKEN || '043d0e1c-f24a-4f8a-9b8e-41b22715ee53';
const POSTMARK_API_URL = 'https://api.postmarkapp.com';

async function fetchPostmarkServers() {
  try {
    console.log('Fetching Postmark servers...');
    
    const response = await fetch(`${POSTMARK_API_URL}/servers?offset=0&count=100`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Postmark-Account-Token': POSTMARK_ACCOUNT_TOKEN
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch servers: ${response.status}`);
    }

    const data = await response.json();
    console.log('\n=== POSTMARK SERVERS ===\n');
    
    const serverTokens = {};
    
    for (const server of data.Servers) {
      console.log(`Server Name: ${server.Name}`);
      console.log(`Server ID: ${server.ID}`);
      console.log(`API Token: ${server.ApiTokens[0]}`); // Primary token
      console.log('---');
      
      // Store for later use
      serverTokens[server.Name] = {
        id: server.ID,
        token: server.ApiTokens[0],
        name: server.Name
      };
    }
    
    // Generate SQL update statements
    console.log('\n=== SQL UPDATE STATEMENTS ===\n');
    
    // Update shared server token
    if (serverTokens['komunate-shared']) {
      console.log(`-- Update shared server token`);
      console.log(`UPDATE contacts.shared_postmark_config`);
      console.log(`SET server_token = '${serverTokens['komunate-shared'].token}'`);
      console.log(`WHERE server_name = 'komunate-shared';`);
      console.log('');
    }
    
    // Update dedicated server tokens based on postmark_id
    for (const [name, info] of Object.entries(serverTokens)) {
      if (name.includes('-transactional') || name.includes('-marketing')) {
        const postmarkId = name.split('-')[0]; // Extract tenant postmark_id
        const isTransactional = name.includes('-transactional');
        
        console.log(`-- Update ${name}`);
        console.log(`UPDATE contacts.postmark_settings`);
        if (isTransactional) {
          console.log(`SET dedicated_transactional_token = '${info.token}'`);
        } else {
          console.log(`SET dedicated_marketing_token = '${info.token}'`);
        }
        console.log(`WHERE tenant_id IN (`);
        console.log(`  SELECT id FROM public.tenants WHERE postmark_id = '${postmarkId}'`);
        console.log(`);`);
        console.log('');
      }
    }
    
    // Also generate a complete update for all tenants
    console.log('\n=== COMPLETE TOKEN UPDATE ===\n');
    console.log(`-- Update all tenants with shared mode to use shared token`);
    console.log(`UPDATE contacts.postmark_settings`);
    console.log(`SET shared_server_token = '${serverTokens['komunate-shared']?.token || 'NEEDS_TOKEN'}'`);
    console.log(`WHERE server_mode = 'shared';`);
    console.log('');
    
    return serverTokens;
    
  } catch (error) {
    console.error('Error fetching Postmark servers:', error);
  }
}

// Run the script
fetchPostmarkServers();