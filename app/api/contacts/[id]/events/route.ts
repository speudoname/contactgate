import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'contacts'
  }
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized - No tenant ID' }, { status: 401 })
    }

    // Fetch events for this contact
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('contact_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100) // Get last 100 events

    if (error) {
      console.error('Error fetching events:', error)
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    // Group events by category for better display
    const groupedEvents: Record<string, any[]> = {
      system: [],
      email: [],
      webinar: [],
      course: [],
      page: [],
      other: []
    }

    events?.forEach(event => {
      const category = event.event_category || 'other'
      if (category in groupedEvents) {
        groupedEvents[category].push(event)
      } else {
        groupedEvents.other.push(event)
      }
    })

    return NextResponse.json({ 
      events: events || [],
      grouped: groupedEvents,
      total: events?.length || 0
    })
  } catch (error) {
    console.error('Error in events API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}