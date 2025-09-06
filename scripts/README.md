# ContactGate Database Scripts

## Setup Order

Run these scripts in your Supabase SQL Editor in the following order:

### 1. setup-contacts-table.sql
Creates the main contacts table with all necessary fields, indexes, and triggers.

### 2. create-reference-tables.sql
Creates reference tables for:
- Lifecycle stages
- Contact sources
- Tag definitions
- Custom field definitions
- Contact tags (junction table)
- Activity summary view

Also fixes PostgreSQL security warnings.

## Important Notes

- All tables are created in the `contacts` schema
- The contacts schema must be exposed in Supabase API settings
- Default data is inserted for each tenant automatically
- All functions use SECURITY DEFINER with proper search_path for security