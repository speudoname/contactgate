'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'

interface PostmarkSettings {
  server_mode?: 'shared' | 'dedicated'
  activation_status?: string
  activation_error?: string
  activated_at?: string
  postmark_id?: string
  transactional_server_id?: number
  transactional_server_token?: string
  transactional_stream_id?: string
  marketing_server_id?: number
  marketing_server_token?: string
  marketing_stream_id?: string
  track_opens?: boolean
  track_links?: string
  custom_from_email?: string
  custom_from_name?: string
  custom_reply_to?: string
  default_from_email?: string
  default_from_name?: string
  default_reply_to?: string
  account_token?: string
}

interface TenantInfo {
  postmark_id?: string
  email_tier?: string
  email_monthly_limit?: number
}

interface ServerStatus {
  postmarkId?: string
  tenantName?: string
  emailTier?: string
  mode?: 'shared' | 'dedicated'
  isActivated?: boolean
  canActivate?: boolean
  serversExist?: boolean
  tierLimits?: any
}

export default function EmailSettingsNew() {
  const [settings, setSettings] = useState<PostmarkSettings>({})
  const [tenant, setTenant] = useState<TenantInfo>({})
  const [serverStatus, setServerStatus] = useState<ServerStatus>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [checkingServers, setCheckingServers] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [processResult, setProcessResult] = useState<any>(null)

  useEffect(() => {
    fetchSettings()
    checkServerStatus()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch(getApiUrl('/api/email/settings'))
      
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings || {})
        setTenant(data.tenant || {})
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
      setError('Failed to load email settings')
    } finally {
      setLoading(false)
    }
  }

  const checkServerStatus = async () => {
    try {
      setCheckingServers(true)
      const response = await fetch(getApiUrl('/api/email/check-servers'))
      
      if (response.ok) {
        const data = await response.json()
        setServerStatus(data)
      }
    } catch (err) {
      console.error('Failed to check server status:', err)
    } finally {
      setCheckingServers(false)
    }
  }

  const handleActivateService = async () => {
    if (!confirm('This will create dedicated email servers for your tenant. Continue?')) {
      return
    }

    setActivating(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(getApiUrl('/api/email/activate-service'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setSuccess('Email service activated successfully! Your dedicated servers are now ready.')
        // Refresh settings and status
        await fetchSettings()
        await checkServerStatus()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to activate email service')
      }
    } catch (err) {
      console.error('Activation error:', err)
      setError('Failed to activate email service')
    } finally {
      setActivating(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(getApiUrl('/api/email/settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          custom_from_email: settings.custom_from_email,
          custom_from_name: settings.custom_from_name,
          custom_reply_to: settings.custom_reply_to,
          track_opens: settings.track_opens,
          track_links: settings.track_links
        })
      })

      if (response.ok) {
        setSuccess('Settings saved successfully')
        await fetchSettings()
      } else {
        setError('Failed to save settings')
      }
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    const testEmail = prompt('Enter email address to send test to:')
    if (!testEmail) return

    setError('')
    setSuccess('')

    try {
      const response = await fetch(getApiUrl('/api/email/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: testEmail,
          mode: settings.server_mode
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess(`Test email queued! Check ${testEmail} in about 30 seconds. Queue ID: ${data.queue_id}`)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to queue test email')
      }
    } catch (err) {
      console.error('Test email error:', err)
      setError('Failed to queue test email')
    }
  }

  const handleProcessQueue = async () => {
    setIsProcessingQueue(true)
    setProcessResult(null)

    try {
      const response = await fetch(getApiUrl('/api/email/process-queue'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      if (response.ok) {
        setProcessResult({
          success: true,
          message: 'Queue processed successfully',
          details: data.result
        })
      } else {
        setProcessResult({
          success: false,
          message: data.error || 'Failed to process queue',
          details: data.details
        })
      }
    } catch (err) {
      console.error('Process queue error:', err)
      setProcessResult({
        success: false,
        message: 'Failed to trigger queue processing',
        details: err
      })
    } finally {
      setIsProcessingQueue(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    )
  }

  const isSharedMode = settings.server_mode === 'shared'
  const isDedicatedMode = settings.server_mode === 'dedicated'
  const canActivate = serverStatus.canActivate && tenant.email_tier !== 'free'

  return (
    <div className="space-y-6">
      {/* Server Status Card */}
      <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-xl font-bold mb-4">Email Service Status</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-600">Current Mode</label>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isSharedMode 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {isSharedMode ? '🌐 Shared Server' : '🔒 Dedicated Servers'}
              </span>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-600">Email Tier</label>
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize">{tenant.email_tier || 'free'}</span>
              <span className="text-sm text-gray-500">
                ({tenant.email_monthly_limit?.toLocaleString() || '1,000'} emails/month)
              </span>
            </div>
          </div>

          {tenant.postmark_id && (
            <div>
              <label className="text-sm text-gray-600">Postmark ID</label>
              <div className="font-mono font-bold">{tenant.postmark_id}</div>
            </div>
          )}

          {isDedicatedMode && settings.activated_at && (
            <div>
              <label className="text-sm text-gray-600">Activated</label>
              <div className="text-sm">{new Date(settings.activated_at).toLocaleDateString()}</div>
            </div>
          )}
        </div>

        {/* Shared Mode Info */}
        {isSharedMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <h4 className="font-medium text-blue-900 mb-2">📧 Shared Email Service</h4>
            <p className="text-sm text-blue-700 mb-3">
              You're currently using our shared email infrastructure. This is perfect for getting started and testing.
            </p>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>✓ No setup required</li>
              <li>✓ Instant email sending</li>
              <li>✓ Default sender: {settings.default_from_email || 'share@share.komunate.com'}</li>
              <li>✓ {tenant.email_monthly_limit?.toLocaleString() || '1,000'} emails per month</li>
            </ul>
          </div>
        )}

        {/* Dedicated Mode Info */}
        {isDedicatedMode && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
            <h4 className="font-medium text-green-900 mb-2">🚀 Dedicated Email Servers Active</h4>
            <p className="text-sm text-green-700 mb-3">
              You have dedicated email servers for maximum deliverability and control.
            </p>
            <ul className="text-sm text-green-600 space-y-1">
              <li>✓ Transactional Server: {tenant.postmark_id}-transactional</li>
              <li>✓ Marketing Server: {tenant.postmark_id}-marketing</li>
              <li>✓ Custom domain support</li>
              <li>✓ Advanced tracking & analytics</li>
            </ul>
          </div>
        )}

        {/* Activation Button */}
        {isSharedMode && (
          <div className="border-t pt-4">
            {tenant.email_tier === 'free' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <h4 className="font-medium text-amber-900 mb-2">🎯 Upgrade to Activate Dedicated Servers</h4>
                <p className="text-sm text-amber-700 mb-3">
                  Dedicated email servers are available for Starter, Pro, and Enterprise plans.
                </p>
                <button
                  disabled
                  className="px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
                >
                  Upgrade Plan to Activate
                </button>
              </div>
            ) : !tenant.postmark_id ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 className="font-medium text-red-900 mb-2">⚠️ Postmark ID Required</h4>
                <p className="text-sm text-red-700">
                  A Postmark ID must be assigned to your tenant before activating dedicated servers.
                  Please contact support.
                </p>
              </div>
            ) : (
              <div>
                <h4 className="font-medium mb-2">Ready to Activate Dedicated Servers?</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Create dedicated email servers for better deliverability, custom domains, and advanced features.
                </p>
                <button
                  onClick={handleActivateService}
                  disabled={activating || !canActivate}
                  className={`px-6 py-2 border-2 border-black font-medium rounded-md transition-all ${
                    activating || !canActivate
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-green-400 hover:bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  {activating ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Activating...
                    </span>
                  ) : (
                    '🚀 Activate Dedicated Servers'
                  )}
                </button>
                {settings.activation_error && (
                  <p className="text-sm text-red-600 mt-2">{settings.activation_error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email Configuration */}
      <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-xl font-bold mb-4">Email Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">From Email</label>
            <input
              type="email"
              value={settings.custom_from_email || ''}
              onChange={(e) => setSettings({ ...settings, custom_from_email: e.target.value })}
              placeholder={isSharedMode ? settings.default_from_email : 'noreply@yourdomain.com'}
              className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSharedMode}
            />
            {isSharedMode && (
              <p className="text-xs text-gray-500 mt-1">
                Upgrade to dedicated servers to use custom sender email
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">From Name</label>
            <input
              type="text"
              value={settings.custom_from_name || ''}
              onChange={(e) => setSettings({ ...settings, custom_from_name: e.target.value })}
              placeholder={settings.default_from_name || 'Your Company'}
              className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reply-To Email</label>
            <input
              type="email"
              value={settings.custom_reply_to || ''}
              onChange={(e) => setSettings({ ...settings, custom_reply_to: e.target.value })}
              placeholder={settings.default_reply_to || 'support@yourdomain.com'}
              className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isDedicatedMode && (
            <>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Tracking Settings</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.track_opens || false}
                      onChange={(e) => setSettings({ ...settings, track_opens: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Track email opens</span>
                  </label>
                  
                  <div>
                    <label className="block text-sm mb-1">Track Links</label>
                    <select
                      value={settings.track_links || 'None'}
                      onChange={(e) => setSettings({ ...settings, track_links: e.target.value })}
                      className="px-3 py-1 border-2 border-black rounded-md"
                    >
                      <option value="None">None</option>
                      <option value="HtmlAndText">HTML and Text</option>
                      <option value="HtmlOnly">HTML Only</option>
                      <option value="TextOnly">Text Only</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className={`px-4 py-2 border-2 border-black font-medium rounded-md transition-all ${
              saving
                ? 'bg-gray-200 text-gray-500'
                : 'bg-blue-400 hover:bg-blue-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>

          <button
            onClick={handleTestEmail}
            className="px-4 py-2 border-2 border-black font-medium rounded-md bg-yellow-400 hover:bg-yellow-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            📧 Send Test Email
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 p-4 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-2 border-green-500 text-green-700 p-4 rounded-md">
          {success}
        </div>
      )}

      {/* Queue Processing Section (Dev Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-xl font-bold mb-4">🚀 Email Queue Processing (Dev)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Manually trigger email queue processing. In production, this runs automatically every 30 seconds via UptimeMonitor.
          </p>
          <button
            onClick={handleProcessQueue}
            disabled={isProcessingQueue}
            className={`px-6 py-3 border-2 border-black font-medium rounded-md transition-all ${
              isProcessingQueue
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-purple-400 hover:bg-purple-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {isProcessingQueue ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing Queue...
              </span>
            ) : (
              '⚡ Process Email Queue Now'
            )}
          </button>
          {processResult && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${processResult.success ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
              <p className={`font-medium ${processResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {processResult.message}
              </p>
              {processResult.details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-gray-600">View Details</summary>
                  <pre className="mt-2 text-xs overflow-auto bg-gray-100 p-2 rounded">
                    {JSON.stringify(processResult.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}