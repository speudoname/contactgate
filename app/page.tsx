import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ContactsPage() {
  const { userId, orgId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to NumGate
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold mb-6">Contact Management</h1>
        
        <div className="bg-white p-8 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-xl font-bold mb-4">Contacts System</h2>
          <p className="text-gray-600 mb-4">
            The contact management system is being rebuilt with the new architecture.
          </p>
          <p className="text-gray-600">
            Features coming soon:
          </p>
          <ul className="list-disc list-inside text-gray-600 mt-2">
            <li>Contact list view</li>
            <li>Add/Edit contacts</li>
            <li>Import/Export</li>
            <li>Tagging and segmentation</li>
            <li>Activity tracking</li>
          </ul>
        </div>
      </div>
    </div>
  )
}