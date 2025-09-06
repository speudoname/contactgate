import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function GET(request: NextRequest) {
  try {
    // Log all headers for debugging
    console.log('API Headers:', {
      'x-tenant-id': request.headers.get('x-tenant-id'),
      'x-user-id': request.headers.get('x-user-id'),
      'x-proxied-from': request.headers.get('x-proxied-from'),
      'x-auth-token': request.headers.get('x-auth-token')
    })
    
    // Get tenant context from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      console.error('No tenant ID in headers')
      return NextResponse.json({ error: 'Unauthorized - No tenant ID' }, { status: 401 })
    }

    console.log('Fetching contacts for tenant:', tenantId)
    
    // Fetch contacts from the contacts schema - Supabase uses dot notation
    const { data: contacts, error } = await supabase
      .schema('contacts')  // Specify the schema first
      .from('contacts')    // Then the table name
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching contacts:', error)
      return NextResponse.json({ 
        error: 'Database error', 
        details: error.message,
        code: error.code 
      }, { status: 500 })
    }

    console.log('Found contacts:', contacts?.length || 0)
    return NextResponse.json({ contacts: contacts || [] })
  } catch (error) {
    console.error('Error in contacts API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get tenant context from headers
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Create new contact in contacts schema
    const { data: contact, error } = await supabase
      .schema('contacts')
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
        company: body.company,
        job_title: body.job_title,
        lifecycle_stage: body.lifecycle_stage || 'subscriber',
        source: body.source || 'manual',
        email_opt_in: body.email_opt_in || false,
        notes: body.notes
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating contact:', error)
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    }

    // Log event in contacts schema
    await supabase
      .schema('contacts')
      .from('events')
      .insert({
        tenant_id: tenantId,
        contact_id: contact.id,
        event_type: 'contact.created',
        event_category: 'system',
        source_app: 'contacts',
        properties: {
          created_by: userId
        }
      })

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Error in contacts API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}