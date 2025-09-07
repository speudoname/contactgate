# Email System Testing Guide

## Prerequisites - MUST DO FIRST!

### 1. Run Database Migrations
The token columns haven't been added to the database yet. You need to run these migrations:

```bash
# Go to Supabase Dashboard > SQL Editor and run these scripts in order:

# 1. First, run the add-postmark-api-tokens.sql
# Location: /Users/apple/komunate/contactgate/scripts/add-postmark-api-tokens.sql

# 2. Then, run the populate-postmark-tokens.sql  
# Location: /Users/apple/komunate/contactgate/scripts/populate-postmark-tokens.sql
```

### 2. Deploy Edge Function (if not already done)
```bash
cd /Users/apple/komunate/contactgate
npx supabase functions deploy process-email-queue
```

## Testing Steps

### Step 1: Check Token Status
After running migrations, verify tokens are populated:
```bash
cd /Users/apple/komunate/contactgate
node scripts/check-and-populate-tokens.js
```

You should see:
- Komunate Platform: ✅ Has tokens (shared mode)
- Other tenants: Either ✅ (if they have dedicated servers) or need assignment

### Step 2: Test Email via ContactGate UI

1. **Navigate to Email Settings**
   - Go to: http://localhost:3001/contacts (or your ContactGate URL)
   - Click on "Email Settings" tab
   - You should see the Email Settings interface

2. **Send Test Email**
   - In the Test Email section
   - Enter your email address
   - Click "Send Test Email"
   - Watch for success/error messages

3. **Manual Queue Processing (Development)**
   - Click "Process Email Queue (Dev)" button
   - This manually triggers the edge function
   - Check console for processing logs

### Step 3: Test via NumGate Super Admin

1. **Go to Super Admin Postmark Config**
   - URL: http://localhost:3000/super-admin/postmark
   - Select a tenant from dropdown
   - Assign servers (tokens will auto-populate)

2. **For Default/Shared Configuration**
   - Select "Default Configuration" 
   - Choose the "defaultsharednumagte" server
   - Token should auto-populate: `59cf1ddb-d888-43b8-9d6d-a56879df5bd6`
   - Save configuration

3. **For Tenant-Specific Configuration**
   - Select a specific tenant
   - Either:
     - Choose existing server (token auto-populates)
     - Click "Auto-Create Servers" to create new ones
   - Save configuration

### Step 4: Verify in Postmark Dashboard

1. **Check Postmark Activity**
   - Go to: https://account.postmarkapp.com/
   - Select the appropriate server
   - Check Activity feed for sent emails

2. **Expected Results**
   - Test emails should appear in activity
   - Transactional emails: No tracking
   - Marketing emails: Open/click tracking enabled

### Step 5: Check Email Queue Status

Run this query in Supabase SQL Editor:
```sql
-- Check transactional queue
SELECT * FROM contacts.email_queue_transactional 
ORDER BY created_at DESC LIMIT 10;

-- Check marketing queue  
SELECT * FROM contacts.email_queue_marketing
ORDER BY created_at DESC LIMIT 10;

-- Check postmark settings
SELECT 
  ps.*,
  t.name as tenant_name
FROM contacts.postmark_settings ps
LEFT JOIN public.tenants t ON t.id = ps.tenant_id;
```

## Troubleshooting

### If emails aren't sending:

1. **Check tokens are populated**
   ```sql
   SELECT * FROM contacts.postmark_settings;
   SELECT * FROM contacts.shared_postmark_config;
   ```

2. **Check Edge Function logs**
   - Go to Supabase Dashboard > Functions
   - Select `process-email-queue`
   - Check logs for errors

3. **Verify Postmark tokens are valid**
   - Test tokens directly in Postmark API playground
   - Check server exists and is active

4. **Common Issues:**
   - Missing tokens: Run populate script
   - Wrong schema: Ensure using `contacts` schema
   - Edge function not deployed: Deploy it
   - CORS issues: Check Edge Function CORS headers

## Clean Up Old Implementation

### Files Already Removed:
- ✅ `/api/email/` routes (deleted)
- ✅ `PostmarkService` class (deleted)
- ✅ `EmailComposer` component (deleted)

### Database Tables Cleaned:
- ✅ Removed 60% of unused tables
- ✅ Kept only essential email tables

### What's New:
- ✅ Email queue architecture
- ✅ Per-server API tokens
- ✅ Auto-token fetching in admin
- ✅ Edge Function for processing

## Production Deployment Checklist

1. [ ] Run all migrations in production
2. [ ] Deploy Edge Function to production
3. [ ] Configure UptimeMonitor to trigger every 30 seconds
4. [ ] Populate production tenant tokens
5. [ ] Test with production Postmark servers
6. [ ] Monitor Postmark activity dashboard

## API Token Reference

### Default Shared Server
- Server: `defaultsharednumagte`
- Token: `59cf1ddb-d888-43b8-9d6d-a56879df5bd6`

### Known Tenant Servers
- Vibenar: `a99437c1-ce0c-4c50-800a-310c7257701a`
- MUS001 (Betlemi10): `fec0c42d-3701-463c-8f26-71545147be7e`
- AIX001 (aiacademy.ge): `8e9d16a7-bb09-4fc0-8509-de30207de037`

## Next Steps After Testing

1. Configure UptimeMonitor to auto-trigger Edge Function
2. Set up monitoring/alerts for failed emails
3. Implement retry logic monitoring
4. Add email analytics dashboard