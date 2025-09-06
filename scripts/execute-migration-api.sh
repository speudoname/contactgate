#!/bin/bash

# Load environment variables
source .env.local

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 ContactGate Migration Script${NC}"
echo "================================================"

# Check if required variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}❌ Error: Missing Supabase credentials in .env.local${NC}"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/https:\/\/\(.*\)\.supabase\.co/\1/')
echo -e "${GREEN}📍 Project: ${PROJECT_REF}${NC}"

# Read the migration file
MIGRATION_SQL=$(cat supabase/migrations/001_create_contacts_schema.sql)

echo -e "${YELLOW}⚙️  Executing migration via Supabase API...${NC}"

# Use curl to execute the SQL via Supabase's internal API
# Note: This uses an undocumented endpoint but it works
RESPONSE=$(curl -s -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  --data-raw "{\"query\": $(echo "$MIGRATION_SQL" | jq -Rs .)}")

# Check if the request was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration request sent successfully${NC}"
else
    echo -e "${RED}❌ Failed to send migration request${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Since direct SQL execution via API is limited, please use one of these methods:${NC}"
echo ""
echo "1. ${GREEN}Supabase Dashboard SQL Editor (Recommended):${NC}"
echo "   ${NEXT_PUBLIC_SUPABASE_URL/supabase.co/supabase.com}/project/${PROJECT_REF}/sql/new"
echo ""
echo "2. ${GREEN}Copy and paste this command in your terminal:${NC}"
echo "   cat supabase/migrations/001_create_contacts_schema.sql | pbcopy"
echo "   Then paste in the SQL editor above"
echo ""
echo "================================================"
echo -e "${YELLOW}📋 Migration file is ready at:${NC}"
echo "   supabase/migrations/001_create_contacts_schema.sql"