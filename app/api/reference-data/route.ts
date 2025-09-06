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

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized - No tenant ID' }, { status: 401 })
    }

    // Fetch all reference data in parallel
    const [lifecycleStages, sources, tags] = await Promise.all([
      supabase
        .from('lifecycle_stages')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('order_index'),
      
      supabase
        .from('sources')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('display_name'),
      
      supabase
        .from('tag_definitions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name')
    ])

    // Check for errors
    if (lifecycleStages.error) {
      console.error('Error fetching lifecycle stages:', lifecycleStages.error)
    }
    if (sources.error) {
      console.error('Error fetching sources:', sources.error)
    }
    if (tags.error) {
      console.error('Error fetching tags:', tags.error)
    }

    return NextResponse.json({
      lifecycleStages: lifecycleStages.data || [],
      sources: sources.data || [],
      tags: tags.data || []
    })
  } catch (error) {
    console.error('Error fetching reference data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}