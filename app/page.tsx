'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Contact {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  lifecycle_stage: string
  lead_score: number
  created_at: string
  last_activity_at: string | null
  tags: string[]
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/contacts')
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token might be invalid, redirect to gateway
          window.location.href = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000'
          return
        }
        throw new Error('Failed to fetch contacts')
      }

      const data = await response.json()
      setContacts(data.contacts || [])
    } catch (err) {
      setError('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleAddContact = () => {
    router.push('/contacts/new')
  }

  const handleViewContact = (contactId: string) => {
    router.push(`/contacts/${contactId}`)
  }

  const filteredContacts = contacts.filter(contact => {
    const searchLower = searchTerm.toLowerCase()
    return (
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.first_name?.toLowerCase().includes(searchLower) ||
      contact.last_name?.toLowerCase().includes(searchLower)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading contacts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold">Contact Management</h1>
              <p className="text-sm text-gray-600">{contacts.length} total contacts</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000'}
                className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Back to NumGate
              </button>
              <button
                onClick={handleAddContact}
                className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-green-400 hover:bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                + Add Contact
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search contacts by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Contacts List */}
        {filteredContacts.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-gray-600">
              {searchTerm ? 'No contacts found matching your search.' : 'No contacts yet. Add your first contact!'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b-2 border-black">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {contact.full_name || 'No name'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{contact.email || 'No email'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {contact.lifecycle_stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contact.lead_score}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(contact.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewContact(contact.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}