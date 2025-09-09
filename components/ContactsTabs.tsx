'use client'

interface ContactsTabsProps {
  activeTab: 'contacts' | 'email' | 'settings'
  onTabChange: (tab: 'contacts' | 'email' | 'settings') => void
}

export default function ContactsTabs({ activeTab, onTabChange }: ContactsTabsProps) {
  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onTabChange('contacts')}
        className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md transition-all ${
          activeTab === 'contacts'
            ? 'bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-white hover:bg-gray-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        📋 Contacts
      </button>
      <button
        onClick={() => onTabChange('email')}
        className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md transition-all ${
          activeTab === 'email'
            ? 'bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-white hover:bg-gray-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        ✉️ Send Email
      </button>
      <button
        onClick={() => onTabChange('settings')}
        className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md transition-all ${
          activeTab === 'settings'
            ? 'bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-white hover:bg-gray-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        ⚙️ Email Settings
      </button>
    </div>
  )
}
