'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'

interface PostmarkSettings {
  id?: string
  postmark_id?: string
  transactional_server_id?: number
  transactional_server_name?: string
  transactional_server_token?: string
  transactional_stream_id?: string
  marketing_server_id?: number
  marketing_server_name?: string
  marketing_server_token?: string
  marketing_stream_id?: string
  track_opens?: boolean
  track_links?: string
  domain_id?: number
  domain_name?: string
  domain_verified?: boolean
  default_from_email?: string
  default_from_name?: string
  default_reply_to?: string
  account_token?: string
}

export default function EmailSettings() {
  const [settings, setSettings] = useState<PostmarkSettings>({
    account_token: process.env.NEXT_PUBLIC_POSTMARK_ACCOUNT_TOKEN || '',
    transactional_stream_id: 'outbound',
    marketing_stream_id: 'broadcasts',
    track_opens: false,
    track_links: 'None'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testingEmail, setTestingEmail] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch(getApiUrl('/api/email/settings'))
      
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setSettings(data.settings)
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(getApiUrl('/api/email/settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings')
      }

      setSuccess('Settings saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!settings.default_from_email) {
      setError('Please set a default from email first')
      return
    }

    setTestingEmail(true)
    setError('')

    try {
      const response = await fetch(getApiUrl('/api/email/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: settings.default_from_email,
          subject: 'ContactGate Email Test',
          htmlBody: '<h1>Test Email</h1><p>This is a test email from ContactGate to verify your email configuration is working correctly.</p>',
          serverType: 'transactional'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email')
      }

      setSuccess(`Test email sent successfully! Check ${settings.default_from_email}`)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test email')
    } finally {
      setTestingEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-xl font-bold mb-4">📧 Email Configuration (Postmark)</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 border-2 border-green-500 rounded text-green-700">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Account Settings */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-700">Account Configuration</h3>
            <div className="space-y-4 p-4 bg-gray-50 rounded-md">
              <div>
                <label className="block text-sm font-medium mb-1">Postmark Account Token *</label>
                <input
                  type="password"
                  value={settings.account_token || ''}
                  onChange={(e) => setSettings({ ...settings, account_token: e.target.value })}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Used to manage servers and domains</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Postmark ID</label>
                <input
                  type="text"
                  value={settings.postmark_id || ''}
                  onChange={(e) => setSettings({ ...settings, postmark_id: e.target.value })}
                  placeholder="ABC001"
                  maxLength={6}
                  className="w-32 px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">6-character identifier for naming convention</p>
              </div>
            </div>
          </div>

          {/* Transactional Server */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-700">Transactional Server (Orders, Passwords, etc.)</h3>
            <div className="space-y-4 p-4 bg-blue-50 rounded-md">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Server ID</label>
                  <input
                    type="number"
                    value={settings.transactional_server_id || ''}
                    onChange={(e) => setSettings({ ...settings, transactional_server_id: parseInt(e.target.value) })}
                    placeholder="123456"
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Server Name</label>
                  <input
                    type="text"
                    value={settings.transactional_server_name || ''}
                    onChange={(e) => setSettings({ ...settings, transactional_server_name: e.target.value })}
                    placeholder="My Transactional Server"
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Server Token *</label>
                <input
                  type="password"
                  value={settings.transactional_server_token || ''}
                  onChange={(e) => setSettings({ ...settings, transactional_server_token: e.target.value })}
                  placeholder="Server API token"
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stream ID</label>
                <input
                  type="text"
                  value={settings.transactional_stream_id || 'outbound'}
                  onChange={(e) => setSettings({ ...settings, transactional_stream_id: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    className="mr-2"
                  />
                  <span className="text-sm">Track Opens (Disabled for transactional)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Marketing Server */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-700">Marketing Server (Campaigns, Newsletters)</h3>
            <div className="space-y-4 p-4 bg-green-50 rounded-md">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Server ID</label>
                  <input
                    type="number"
                    value={settings.marketing_server_id || ''}
                    onChange={(e) => setSettings({ ...settings, marketing_server_id: parseInt(e.target.value) })}
                    placeholder="789012"
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Server Name</label>
                  <input
                    type="text"
                    value={settings.marketing_server_name || ''}
                    onChange={(e) => setSettings({ ...settings, marketing_server_name: e.target.value })}
                    placeholder="My Marketing Server"
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Server Token</label>
                <input
                  type="password"
                  value={settings.marketing_server_token || ''}
                  onChange={(e) => setSettings({ ...settings, marketing_server_token: e.target.value })}
                  placeholder="Server API token"
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stream ID</label>
                <input
                  type="text"
                  value={settings.marketing_stream_id || 'broadcasts'}
                  onChange={(e) => setSettings({ ...settings, marketing_stream_id: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.track_opens || false}
                    onChange={(e) => setSettings({ ...settings, track_opens: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Track Opens</span>
                </label>

                <div>
                  <label className="block text-sm font-medium mb-1">Track Links</label>
                  <select
                    value={settings.track_links || 'None'}
                    onChange={(e) => setSettings({ ...settings, track_links: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="None">Don't track links</option>
                    <option value="HtmlAndText">Track all links</option>
                    <option value="HtmlOnly">Track HTML links only</option>
                    <option value="TextOnly">Track text links only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Domain Settings */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-700">Domain & Sender Settings</h3>
            <div className="space-y-4 p-4 bg-purple-50 rounded-md">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Domain Name</label>
                  <input
                    type="text"
                    value={settings.domain_name || ''}
                    onChange={(e) => setSettings({ ...settings, domain_name: e.target.value })}
                    placeholder="example.com"
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Domain ID</label>
                  <input
                    type="number"
                    value={settings.domain_id || ''}
                    onChange={(e) => setSettings({ ...settings, domain_id: parseInt(e.target.value) })}
                    placeholder="12345"
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.domain_verified || false}
                  onChange={(e) => setSettings({ ...settings, domain_verified: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm">Domain Verified</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Default From Email *</label>
                <input
                  type="email"
                  value={settings.default_from_email || ''}
                  onChange={(e) => setSettings({ ...settings, default_from_email: e.target.value })}
                  placeholder="noreply@example.com"
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Default From Name</label>
                  <input
                    type="text"
                    value={settings.default_from_name || ''}
                    onChange={(e) => setSettings({ ...settings, default_from_name: e.target.value })}
                    placeholder="Your Company"
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Reply-To</label>
                  <input
                    type="email"
                    value={settings.default_reply_to || ''}
                    onChange={(e) => setSettings({ ...settings, default_reply_to: e.target.value })}
                    placeholder="support@example.com"
                    className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-green-400 hover:bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Saving...' : '💾 Save Settings'}
            </button>

            <button
              onClick={handleTestEmail}
              disabled={testingEmail || !settings.default_from_email}
              className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-blue-400 hover:bg-blue-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all ${
                testingEmail || !settings.default_from_email ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {testingEmail ? 'Sending...' : '✉️ Send Test Email'}
            </button>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-yellow-50 p-4 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="font-semibold mb-2">📌 Quick Setup Guide</h3>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>Get your Postmark Account Token from your Postmark account settings</li>
          <li>Create two servers in Postmark: one for transactional, one for marketing</li>
          <li>Copy the Server IDs and Server Tokens from Postmark</li>
          <li>Set up your domain in Postmark and verify it</li>
          <li>Configure your default sender email address</li>
          <li>Save settings and send a test email</li>
        </ol>
      </div>
    </div>
  )
}