import { NextRequest, NextResponse } from 'next/server'
import { supabaseContacts } from '@/lib/supabase/server'
import { ApiResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    // Get tenant context from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      console.error('No tenant ID in headers')
      return ApiResponse.unauthorized('No tenant ID provided')
    }
    
    // Parse pagination parameters with sensible defaults
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return ApiResponse.badRequest(
        'Invalid pagination parameters',
        'Page must be >= 1, limit must be 1-100'
      )
    }
    
    // Fetch contacts with pagination
    const { data: contacts, error, count } = await supabaseContacts
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching contacts:', error)
      return ApiResponse.internalError('Failed to fetch contacts', error.message)
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    return ApiResponse.success(
      { contacts: contacts || [] },
      undefined,
      {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    )
  } catch (error) {
    console.error('Error in contacts API:', error)
    return ApiResponse.internalError('Internal server error')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get tenant context from headers
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      return ApiResponse.unauthorized('Missing tenant or user ID')
    }

    const body = await request.json()
    
    // Create new contact in the contacts schema
    const { data: contact, error } = await supabaseContacts
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
        lifecycle_stage: body.lifecycle_stage || 'subscriber',
        source: body.source || 'manual',
        email_opt_in: body.email_opt_in || false,
        notes: body.notes
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating contact:', error)
      return ApiResponse.internalError('Failed to create contact', error.message)
    }

    // Log event in contacts schema
    await supabaseContacts
      .from('events')  // Now uses contacts schema by default
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

    return ApiResponse.success({ contact }, 'Contact created successfully')
  } catch (error) {
    console.error('Error in contacts API:', error)
    return ApiResponse.internalError('Internal server error')
  }
}