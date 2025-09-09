'use client'

interface ContactsHeaderProps {
  contacts: any[]
  loading: boolean
  refreshing: boolean
  onAddContact: () => void
  onRefresh: () => void
}

export default function ContactsHeader({
  contacts,
  loading,
  refreshing,
  onAddContact,
  onRefresh
}: ContactsHeaderProps) {
  return (
    <header className="bg-white border-b-2 border-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="mt-2 text-gray-600">
              {loading ? 'Loading...' : refreshing ? 'Refreshing...' : `${contacts.length} contacts`}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onRefresh}
              disabled={loading || refreshing}
              className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
            
            <button
              onClick={onAddContact}
              className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-green-400 hover:bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              + Add Contact
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
