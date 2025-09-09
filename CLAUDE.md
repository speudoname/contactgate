# ContactGate - Contact Management CLAUDE.md

## 🎯 PROJECT CONTEXT
**ContactGate is a PROXIED APPLICATION within the NumGate multi-tenant SaaS platform.** It provides contact management functionality and is accessed ONLY through the NumGate gateway.

### Architecture Overview
- **Proxy Access Only**: Accessed via NumGate at `/contacts` route
- **Gateway Dependency**: NumGate handles authentication and tenant management
- **JWT Authentication**: Uses NumGate's JWT tokens (shared secret)
- **Tenant Isolation**: Strict tenant-based data separation
- **Shared Infrastructure**: Same Supabase instance as NumGate

### Integration with NumGate
- **Authentication**: Receives JWT tokens from NumGate gateway
- **Tenant Context**: Gets tenant_id from JWT headers
- **Data Isolation**: All queries filtered by tenant_id
- **Proxy Routing**: Never accessed directly, always through gateway

## 🔒 CRITICAL SECURITY RULES

### Authentication Pattern (MUST MATCH NUMGATE)
- **Custom JWT Authentication** (not Supabase Auth)
- **Service Key Pattern**: Use `supabaseAdmin` with STRICT tenant filtering
- **Security Rule**: EVERY query MUST include `.eq('tenant_id', tenantId)`

### Service Key Usage
```typescript
// ✅ CORRECT - Always filter by tenant
const { data } = await supabaseAdmin
  .from('contacts.contacts')
  .select('*')
  .eq('tenant_id', tenantId) // MANDATORY
```

### Security Checklist
1. ✅ Use service key with MANDATORY tenant filtering
2. ✅ Validate JWT token from NumGate gateway
3. ✅ Check user belongs to tenant
4. ✅ NEVER trust client-provided tenant_id
5. ✅ Validate ALL inputs with zod schemas

## 📊 DATABASE ARCHITECTURE

### Schema: `contacts`
All contact-related tables use the `contacts` schema:
- `contacts.contacts` - Main contact records
- `contacts.events` - Activity tracking
- `contacts.tags` - Tag definitions
- `contacts.segments` - Dynamic segments
- `contacts.custom_fields` - Tenant-specific fields

## 🎨 UI/UX STANDARDS
- **USE NEOBRUTALISM.DEV EXCLUSIVELY**: All UI components from NeoBrutalism.dev
- **NO CUSTOM COMPONENTS**: Never create custom UI elements
- **STRICT ADHERENCE**: Copy exact code from neobrutalism.dev
- **NO EXCEPTIONS**: No custom styling allowed

## 🚀 DEPLOYMENT STRATEGY
- **NEVER deploy directly to Vercel**
- **ALWAYS push to GitHub first** → Auto-deployment
- **Workflow**: Changes → Build locally → Commit → Push → Auto-deploy

## 🛠️ DEVELOPMENT RULES
- **NEVER ASSUME**: Always align with user before implementation
- **ASK QUESTIONS**: When unclear, ask for clarification
- **SLOW AND STEADY**: Build incrementally, verify each step
- **CONFIRM APPROACH**: Explain approach and get approval

## 🔧 AVAILABLE TOOLS & ACCESS
- **Vercel CLI**: Full access to Vercel platform
- **Supabase**: Complete access to database (hbopxprpgvrkucztsvnq)
- **Postmark**: Full email system access and configuration
- **Environment Variables**: All necessary keys and secrets available
- **GitHub**: Full repository access for deployment

## 📋 DEVELOPMENT WORKFLOW
1. **Always test with NumGate** - Never access ContactGate directly
2. **Maintain JWT compatibility** - Must match NumGate gateway
3. **Use service key** - With tenant filtering
4. **Follow security patterns** - From NumGate gateway