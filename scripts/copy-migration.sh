#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 ContactGate Migration Helper${NC}"
echo "================================================"
echo ""

# Copy migration to clipboard
if command -v pbcopy &> /dev/null; then
    cat supabase/migrations/001_create_contacts_schema.sql | pbcopy
    echo -e "${GREEN}✅ Migration SQL copied to clipboard!${NC}"
else
    echo -e "${YELLOW}⚠️  Could not copy to clipboard automatically${NC}"
fi

echo ""
echo -e "${BLUE}📋 Instructions to run the migration:${NC}"
echo ""
echo "1. Open your Supabase Dashboard SQL Editor:"
echo -e "   ${GREEN}https://hbopxprpgvrkucztsvnq.supabase.com/project/hbopxprpgvrkucztsvnq/sql/new${NC}"
echo ""
echo "2. Paste the SQL (already in your clipboard) or find it at:"
echo "   supabase/migrations/001_create_contacts_schema.sql"
echo ""
echo "3. Click 'Run' to execute the migration"
echo ""
echo "4. You should see success messages for:"
echo "   - contacts schema creation"
echo "   - 7 tables (contacts, events, tags, segments, etc.)"
echo "   - Multiple indexes and triggers"
echo "   - Row Level Security policies"
echo ""
echo "================================================"
echo -e "${GREEN}✨ After running, your ContactGate database will be ready!${NC}"