import SuperAdminPostmarkConfig from '@/components/SuperAdminPostmarkConfig'

export default function SuperAdminPostmarkPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Super Admin - Postmark Configuration</h1>
          <p className="text-gray-600 mt-2">
            Configure default shared email servers for all tenants
          </p>
        </div>
        
        <SuperAdminPostmarkConfig />
      </div>
    </div>
  )
}