// Centralized types for ContactGate

export interface Contact {
  id: string
  tenant_id: string
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  phone?: string | null
  company?: string | null
  job_title?: string | null
  website?: string | null
  lifecycle_stage: string
  lead_score: number
  source?: string | null
  tags: string[]
  notes?: string | null
  email_opt_in?: boolean
  sms_opt_in?: boolean
  created_at: string
  updated_at?: string
  last_activity_at: string | null
  is_authenticated?: boolean
  user_id?: string | null
}

export interface LifecycleStage {
  id: string
  tenant_id: string
  name: string
  display_name: string
  color: string
  order_index: number
  is_active: boolean
  is_system: boolean
  description?: string
}

export interface Source {
  id: string
  tenant_id: string
  name: string
  display_name: string
  icon?: string
  is_active: boolean
  is_system: boolean
  description?: string
}

export interface Tag {
  id: string
  tenant_id: string
  name: string
  color: string
  category?: string
  is_active: boolean
  description?: string
}

export interface Event {
  id: string
  tenant_id: string
  contact_id: string
  event_type: string
  event_category: string
  source_app: string
  properties?: Record<string, any>
  created_at: string
}

export interface ReferenceData {
  lifecycleStages: LifecycleStage[]
  sources: Source[]
  tags: Tag[]
}

export type ContactInsert = Omit<Contact, 'id' | 'full_name' | 'created_at' | 'updated_at'>
export type ContactUpdate = Partial<ContactInsert>

export type LifecycleStageValue = 'subscriber' | 'lead' | 'marketing_qualified_lead' | 'sales_qualified_lead' | 'opportunity' | 'customer' | 'evangelist'