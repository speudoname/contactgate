'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getApiUrl } from '@/lib/utils/api'
import AddContactModal from './AddContactModal'
import ViewEditContactModal from './ViewEditContactModal'
import EmailSettingsNew from './EmailSettingsNew'
import type { Contact } from '@/types'

export default function ContactsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [showRefreshNotification, setShowRefreshNotification] = useState(false)
  const [activeTab, setActiveTab] = useState<'contacts' | 'email' | 'settings'>('contacts')
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  })

  useEffect(() => {
    // Check if token is in URL params (first time coming from NumGate)
    const tokenFromUrl = searchParams.get('token')
    if (tokenFromUrl) {
      // Store token in cookie for subsequent requests
      document.cookie = `auth-token=${tokenFromUrl}; path=/; secure; samesite=lax`
      // Remove token from URL to clean it up
      router.replace('/')
    }
    
    fetchContacts()
  }, [searchParams, router])

  // Add keyboard shortcut for refresh
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // F5 or Cmd+R (Mac) or Ctrl+R (Windows/Linux)
      if (e.key === 'F5' || ((e.metaKey || e.ctrlKey) && e.key === 'r')) {
        e.preventDefault() // Prevent browser refresh
        handleRefresh()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const fetchContacts = async (isRefresh = false, page = 1, limit = 50) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      }
      
      const apiUrl = getApiUrl(`/api/contacts?page=${page}&limit=${limit}`)
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
        
        if (response.status === 401) {
          setError('Authentication failed - not logged in')
          return
        }
        throw new Error(`API returned ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      
      // Handle both old and new response formats for backward compatibility
      const contacts = data.contacts || data.data?.contacts || []
      const pagination = data.pagination || data.data?.pagination
      
      setContacts(contacts)
      
      // Handle pagination metadata if available
      if (pagination) {
        setPagination(pagination)
      }
      
      setError('') // Clear any previous errors on successful fetch
      
      // Show notification only on manual refresh
      if (isRefresh) {
        setShowRefreshNotification(true)
        setTimeout(() => setShowRefreshNotification(false), 2000)
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err)
      setError(`Failed to load contacts: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchContacts(true)
  }

  const handleAddContact = () => {
    setIsAddModalOpen(true)
  }

  const handleViewContact = (contact: Contact) => {
    setSelectedContact(contact)
    setIsViewModalOpen(true)
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const response = await fetch(getApiUrl(`/api/contacts/${contactId}`), {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }

      // Refresh contacts list
      fetchContacts()
    } catch (err) {
      console.error('Failed to delete contact:', err)
      alert('Failed to delete contact')
    }
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
      {/* Refresh Notification */}
      {showRefreshNotification && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-green-500 text-white px-4 py-2 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            ✅ Contacts refreshed
          </div>
        </div>
      )}

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
                onClick={handleRefresh}
                disabled={refreshing}
                className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-blue-400 hover:bg-blue-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all ${
                  refreshing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {refreshing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Refreshing...
                  </span>
                ) : (
                  '🔄 Refresh'
                )}
              </button>
              <button
                onClick={() => {
                  // Always go to /dashboard (like PageNumGate does)
                  window.location.href = '/dashboard'
                }}
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
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md transition-all ${
              activeTab === 'contacts'
                ? 'bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white hover:bg-gray-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            📋 Contacts
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md transition-all ${
              activeTab === 'email'
                ? 'bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white hover:bg-gray-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            ✉️ Send Email
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md transition-all ${
              activeTab === 'settings'
                ? 'bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white hover:bg-gray-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            ⚙️ Email Settings
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'contacts' ? (
          <>
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
              <>
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
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleViewContact(contact)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
              
              {pagination.totalPages > 1 && (
                <div className="bg-white px-6 py-4 border-t-2 border-black flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} contacts
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => fetchContacts(false, pagination.page - 1, pagination.limit)}
                      disabled={!pagination.hasPrevPage}
                      className="px-3 py-1 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm font-medium">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => fetchContacts(false, pagination.page + 1, pagination.limit)}
                      disabled={!pagination.hasNextPage}
                      className="px-3 py-1 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </>
        ) : activeTab === 'email' ? (
          /* Email Tab Content */
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Email Campaigns</h2>
            <p className="text-gray-600">Email campaign functionality coming soon. Use the Settings tab to configure email service and send test emails.</p>
          </div>
        ) : (
          /* Settings Tab Content */
          <div>
            <EmailSettingsNew />
          </div>
        )}
      </main>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false)
          fetchContacts()
        }}
      />

      {/* View/Edit Contact Modal */}
      {selectedContact && (
        <ViewEditContactModal
          contact={selectedContact}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false)
            setSelectedContact(null)
          }}
          onUpdate={() => {
            fetchContacts()
            setIsViewModalOpen(false)
            setSelectedContact(null)
          }}
        />
      )}
    </div>
  )
}