# ContactGate - Contact Management System for NUM Gate Platform

## CRITICAL: Project Context
**ContactGate is part of the NUM Gate multi-tenant SaaS platform.** It provides unified contact management across all NUM Gate applications.

### Architecture Rules
- **Proxy Access Only** - Accessed via NumGate at `/contacts` route
- **JWT Authentication** - Uses NumGate's JWT tokens for auth
- **Tenant Isolation** - Strict tenant-based data separation
- **Shared Supabase** - Same instance as NumGate (hbopxprpgvrkucztsvnq)
- **Separate Schema** - Uses `contacts` schema in Supabase

## Contact Types

### 1. Authenticated Contacts
- Have user accounts in the system
- Can log in to tenant's platform
- Full profile with password
- Linked to `users` table

### 2. Non-Authenticated Contacts
- Leads, subscribers, opt-ins
- No login capability
- Created from forms, imports, manual entry
- Can be converted to authenticated later

## Database Architecture

### Schema: `contacts`
All contact-related tables use the `contacts` schema for separation:
- `contacts.contacts` - Main contact records
- `contacts.events` - Activity tracking
- `contacts.tags` - Tag definitions
- `contacts.segments` - Dynamic segments
- `contacts.custom_fields` - Tenant-specific fields

## Integration Points

### Incoming Events (From Other Apps)
- Page Builder: Form submissions, page visits
- Orders: Purchase events
- Webinars: Registration, attendance
- LMS: Course enrollment, completion
- Email: Opens, clicks, unsubscribes

### Outgoing Data (To Other Apps)
- Contact profiles for personalization
- Segmentation for targeting
- Activity history for context
- Tags for automation triggers

## Key Features

### Core Functionality
1. **Contact CRUD** - Create, read, update, delete contacts
2. **Event Tracking** - Log all interactions
3. **Tagging System** - Flexible categorization
4. **Segmentation** - Dynamic filtering
5. **Activity Timeline** - Complete history per contact
6. **Import/Export** - Bulk operations
7. **Custom Fields** - Tenant-specific data
8. **Source Tracking** - Where contacts originated

### Advanced Features
- **Lead Scoring** - Automatic qualification
- **Duplicate Detection** - Merge capabilities
- **GDPR Compliance** - Data export/deletion
- **Webhooks** - Real-time notifications

## Security Requirements
- **Tenant Isolation** - No cross-tenant data access
- **PII Protection** - Encrypted sensitive data
- **Audit Logging** - Track all changes
- **Permission Levels** - Role-based access

## API Endpoints

### Internal (For Other NUM Gate Apps)
- `GET /api/contacts` - List contacts
- `GET /api/contacts/:id` - Get single contact
- `POST /api/contacts` - Create contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/events` - Log event
- `GET /api/segments` - Get segments
- `POST /api/tags` - Manage tags

### Webhooks (Outgoing)
- `contact.created`
- `contact.updated`
- `contact.deleted`
- `contact.tagged`
- `event.logged`

## Development Workflow
1. **Always test with NumGate** - Never access directly
2. **Maintain JWT compatibility** - Must match gateway
3. **Use service key** - With tenant filtering
4. **Follow RLS patterns** - From NumGate

## Environment Variables
```
# Supabase (same as NumGate)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# JWT (must match NumGate)
JWT_SECRET=

# App Configuration
NEXT_PUBLIC_APP_URL=
```

## File Structure
```
contactgate/
├── app/
│   ├── api/
│   │   ├── contacts/
│   │   ├── events/
│   │   ├── tags/
│   │   └── segments/
│   ├── contacts/
│   │   ├── page.tsx (list view)
│   │   └── [id]/
│   │       └── page.tsx (detail view)
│   └── layout.tsx
├── components/
│   ├── contacts/
│   ├── events/
│   └── shared/
├── lib/
│   ├── supabase/
│   ├── auth/
│   └── validations/
└── middleware.ts
```

## Performance Considerations
- **Pagination** - Large contact lists
- **Caching** - Frequently accessed data
- **Batch Operations** - Bulk imports/updates
- **Event Queue** - Async processing

## Future Enhancements
- Machine learning for lead scoring
- Predictive segmentation
- Automated data enrichment
- Social media integration
- Advanced duplicate detection