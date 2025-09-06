export interface Contact {
  id: string;
  tenant_id: string;
  
  // Basic Information
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null; // Generated column
  
  // Additional Info
  company?: string | null;
  job_title?: string | null;
  website?: string | null;
  
  // CRM Fields
  lifecycle_stage?: string;
  lead_score?: number;
  source?: string | null;
  
  // Tracking
  tags?: string[];
  notes?: string | null;
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
  
  // Metadata
  created_at?: string;
  updated_at?: string;
  last_activity_at?: string | null;
  
  // Authentication link
  is_authenticated?: boolean;
  user_id?: string | null;
}

export type ContactInsert = Omit<Contact, 'id' | 'full_name' | 'created_at' | 'updated_at'>;
export type ContactUpdate = Partial<ContactInsert>;

export type LifecycleStage = 'subscriber' | 'lead' | 'marketing_qualified_lead' | 'sales_qualified_lead' | 'opportunity' | 'customer' | 'evangelist';

export interface ContactFilter {
  tenant_id?: string;
  email?: string;
  lifecycle_stage?: LifecycleStage;
  tags?: string[];
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
  is_authenticated?: boolean;
}