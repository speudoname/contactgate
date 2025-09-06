import { createClient } from '@supabase/supabase-js';
import type { Contact, ContactInsert, ContactUpdate, ContactFilter } from '@/types/contacts';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Contact operations
export const contactsApi = {
  // Create a new contact
  async create(contact: ContactInsert): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .insert(contact)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
    
    return data;
  },

  // Get all contacts for a tenant
  async getByTenant(tenantId: string): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
    
    return data || [];
  },

  // Get a single contact by ID
  async getById(id: string): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching contact:', error);
      throw error;
    }
    
    return data;
  },

  // Update a contact
  async update(id: string, updates: ContactUpdate): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
    
    return data;
  },

  // Delete a contact
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
    
    return true;
  },

  // Search contacts
  async search(filter: ContactFilter): Promise<Contact[]> {
    let query = supabase.from('contacts').select('*');
    
    if (filter.tenant_id) {
      query = query.eq('tenant_id', filter.tenant_id);
    }
    
    if (filter.email) {
      query = query.ilike('email', `%${filter.email}%`);
    }
    
    if (filter.lifecycle_stage) {
      query = query.eq('lifecycle_stage', filter.lifecycle_stage);
    }
    
    if (filter.email_opt_in !== undefined) {
      query = query.eq('email_opt_in', filter.email_opt_in);
    }
    
    if (filter.sms_opt_in !== undefined) {
      query = query.eq('sms_opt_in', filter.sms_opt_in);
    }
    
    if (filter.is_authenticated !== undefined) {
      query = query.eq('is_authenticated', filter.is_authenticated);
    }
    
    if (filter.tags && filter.tags.length > 0) {
      query = query.contains('tags', filter.tags);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error searching contacts:', error);
      throw error;
    }
    
    return data || [];
  },

  // Bulk import contacts
  async bulkImport(contacts: ContactInsert[]): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .insert(contacts)
      .select();
    
    if (error) {
      console.error('Error bulk importing contacts:', error);
      throw error;
    }
    
    return data || [];
  },

  // Update contact tags
  async updateTags(id: string, tags: string[]): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .update({ tags })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating contact tags:', error);
      throw error;
    }
    
    return data;
  },

  // Update last activity
  async updateLastActivity(id: string): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating last activity:', error);
      throw error;
    }
    
    return data;
  },

  // Get contacts by lifecycle stage
  async getByLifecycleStage(tenantId: string, stage: string): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('lifecycle_stage', stage)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching contacts by lifecycle stage:', error);
      throw error;
    }
    
    return data || [];
  }
};