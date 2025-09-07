# Final Postmark Integration Plan for ContactGate

## Core Architecture Overview

### 1. Two-Mode Email System
- **Shared Mode (Default)**: All new tenants use platform's shared Postmark servers
- **Dedicated Mode (Premium)**: Tenants can activate their own dedicated servers

### 2. Server Strategy
- **Two Separate Servers** per tenant (when dedicated):
  - Transactional Server: No tracking pixels (better deliverability)
  - Marketing Server: Full tracking enabled
- Server naming: `{postmark_id}-transactional` and `{postmark_id}-marketing`

### 3. User Journey
1. Tenant signs up → Gets 6-digit postmark_id (e.g., "ABC001")
2. Default to shared servers → Can send emails immediately
3. User activates dedicated service → Creates own servers
4. Configure custom domain → Verify DNS records
5. Full email autonomy achieved

## Implementation Checklist

### Phase 1: Database Infrastructure ✅
- [x] Create postmark_settings table in contacts schema
- [x] Add postmark_id column to tenants table
- [x] Create email_sends tracking table
- [x] Add email_templates table
- [ ] Add shared_postmark_config table for platform defaults
- [ ] Add server_mode column to postmark_settings
- [ ] Add email_tier to tenants table
- [ ] Add activation_status to postmark_settings

### Phase 2: Shared Server Setup
- [x] Create shared_postmark_config table
- [ ] Fetch existing "defaultsharednumgate" server from Postmark
- [ ] Get server token for shared server
- [ ] Store shared server configuration in database
- [ ] Configure default sender: share@share.komunate.com
- [ ] Use existing streams from defaultsharednumgate server

### Phase 3: Email Service Activation
- [ ] Create activation button UI component
- [ ] Build server existence check API (`/api/email/check-servers`)
- [ ] Create server provisioning API (`/api/email/activate-service`)
- [ ] Implement Postmark API integration for server creation
- [ ] Update database when servers are created
- [ ] Handle server token storage (encrypted)

### Phase 4: Sender Configuration
- [ ] Default sender for shared mode (share@share.komunate.com)
- [ ] Custom sender UI for dedicated mode
- [ ] Signature creation API
- [ ] Signature verification flow
- [ ] DNS record display for verification
- [ ] Verification status tracking

### Phase 5: Email Operations ✅ (Partially)
- [x] PostmarkService class created
- [x] Send single email endpoint
- [x] Send batch email endpoint
- [ ] Update to handle shared vs dedicated mode
- [ ] Stream selection based on server type
- [ ] Tracking configuration per server type

### Phase 6: UI Components
- [x] Basic EmailSettings component
- [x] EmailComposer component
- [ ] ServerStatusCard (show shared vs dedicated)
- [ ] ActivationButton with pricing info
- [ ] ServerManagement panel (dedicated only)
- [ ] DomainVerification interface
- [ ] SignatureManagement interface

### Phase 7: Testing & Validation
- [ ] Test shared server email sending
- [ ] Test dedicated server activation
- [ ] Test server existence checking
- [ ] Test signature verification
- [ ] Test tracking differences (transactional vs marketing)
- [ ] Test tenant isolation

## Database Schema Updates Needed

```sql
-- 1. Shared server configuration (platform-wide)
CREATE TABLE IF NOT EXISTS contacts.shared_postmark_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transactional_server_token TEXT NOT NULL,
  transactional_server_id INTEGER,
  transactional_stream_id TEXT DEFAULT 'transactional-shared',
  marketing_server_token TEXT NOT NULL,
  marketing_server_id INTEGER,
  marketing_stream_id TEXT DEFAULT 'marketing-shared',
  default_from_email TEXT DEFAULT 'share@share.komunate.com',
  default_reply_to TEXT DEFAULT 'noreply@komunate.com',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Update postmark_settings for dual mode
ALTER TABLE contacts.postmark_settings 
ADD COLUMN IF NOT EXISTS server_mode TEXT DEFAULT 'shared' 
  CHECK (server_mode IN ('shared', 'dedicated')),
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS activation_status TEXT DEFAULT 'pending'
  CHECK (activation_status IN ('pending', 'checking', 'active', 'failed'));

-- 3. Add email tier to tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS email_tier TEXT DEFAULT 'free' 
  CHECK (email_tier IN ('free', 'starter', 'pro', 'enterprise'));
```

## API Endpoints Structure

### New Endpoints Needed
```
POST   /api/email/activate-service     - Activate dedicated servers
GET    /api/email/check-servers        - Check if servers exist
POST   /api/email/signatures           - Create sender signature
GET    /api/email/signatures           - List signatures
PUT    /api/email/signatures/:id       - Update signature
DELETE /api/email/signatures/:id       - Delete signature
GET    /api/email/dns-records          - Get DNS records for domain
POST   /api/email/verify-domain        - Trigger domain verification
```

### Updated Endpoints
```
GET    /api/email/settings    - Return shared or dedicated config
POST   /api/email/send        - Route to shared or dedicated server
POST   /api/email/batch       - Route to shared or dedicated server
```

## Service Layer Updates

```typescript
// PostmarkService updates needed
class PostmarkService {
  private mode: 'shared' | 'dedicated'
  private sharedConfig?: SharedConfig
  private dedicatedConfig?: DedicatedConfig

  async initialize(tenantId: string) {
    const settings = await this.getSettings(tenantId)
    
    if (settings.server_mode === 'shared') {
      await this.initializeSharedMode()
    } else {
      await this.initializeDedicatedMode(settings)
    }
  }

  private async initializeSharedMode() {
    this.mode = 'shared'
    this.sharedConfig = await this.getSharedConfig()
    // Use shared server tokens
  }

  private async initializeDedicatedMode(settings: Settings) {
    this.mode = 'dedicated'
    this.dedicatedConfig = settings
    // Use tenant's dedicated server tokens
  }
}
```

## UI Flow Specification

### Email Settings Page States

1. **Shared Mode (Default)**
   ```
   Status: Using Shared Email Service
   - From: share@share.komunate.com (platform default)
   - Custom reply-to: [editable]
   - [Activate Dedicated Service] button
   - Show benefits of upgrading
   ```

2. **Activation Process**
   ```
   Status: Activating Email Service...
   - Checking for existing servers
   - Creating servers (if needed)
   - Configuring streams
   - Setting up default signature
   ```

3. **Dedicated Mode (After Activation)**
   ```
   Status: Dedicated Email Service Active
   - Custom from email: [editable]
   - Custom reply-to: [editable]
   - Server management panel
   - Domain verification tools
   - Signature management
   - Tracking settings
   ```

## Implementation Priority

1. **Critical Path (Week 1)**
   - Shared server infrastructure
   - Update PostmarkService for dual mode
   - Basic activation flow

2. **Core Features (Week 2)**
   - Server existence checking
   - Server creation via API
   - Signature management

3. **Polish & Testing (Week 3)**
   - UI refinements
   - Error handling
   - Comprehensive testing

## Key Design Decisions

1. **Why Manual Activation?**
   - Prevents unused server accumulation
   - Enables pricing tiers
   - Reduces Postmark costs

2. **Why Two Servers?**
   - Tracking is server-level setting
   - Transactional needs high deliverability (no tracking)
   - Marketing needs analytics (full tracking)

3. **Why Shared Default?**
   - Immediate functionality for new users
   - Cost-effective for small tenants
   - Smooth upgrade path

## Success Criteria

- [ ] New tenants can send emails immediately (shared mode)
- [ ] Activation process is one-click simple
- [ ] Server creation is automatic and reliable
- [ ] Existing servers are detected and reused
- [ ] Tenant data is completely isolated
- [ ] Tracking works correctly per server type
- [ ] DNS verification is clear and guided

## Notes & Considerations

- Account token should be environment variable
- Server tokens must be encrypted in database
- Consider rate limiting for shared servers
- Plan for migration of existing tenants
- Document pricing tier limits
- Create admin dashboard for monitoring

---

## Current Status: Implementation Progress

### Completed Today:
1. ✅ Created database schema for shared/dedicated modes
2. ✅ Updated PostmarkService class for dual mode support
3. ✅ Created API endpoints for server activation
4. ✅ Added server existence checking
5. ✅ Created super-admin endpoint for shared server config
6. ✅ Updated settings API to handle both modes

### Important Notes:
- Existing shared server: "defaultsharednumgate" already exists on Postmark
- Server token needs to be obtained from Postmark dashboard and stored via super-admin endpoint
- Two modes: shared (default) and dedicated (premium)

Next Step: Build the Email Settings UI with activation button