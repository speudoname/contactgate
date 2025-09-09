import { SupabaseClientFactory, initializeSupabase } from './shared-client-factory'

// Initialize the shared Supabase client factory
initializeSupabase()

// Export pre-configured clients for backward compatibility
export const supabaseAdmin = SupabaseClientFactory.createAdminClient()
export const supabaseContacts = SupabaseClientFactory.createSchemaClient('contacts')

// Export the factory for advanced use cases
export { SupabaseClientFactory }

// Helper function for backward compatibility
export function getSupabaseWithSchema(schema: string) {
  return SupabaseClientFactory.createSchemaClient(schema)
}