'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'

interface PostmarkServer {
  ID: number
  Name: string
  ApiTokens?: string[]
  Color?: string
  TrackOpens?: boolean
  TrackLinks?: string
}

interface MessageStream {
  ID: string
  ServerID: number
  Name: string
  MessageStreamType: string
  Description?: string
}

interface SharedConfig {
  transactional_server_token?: string
  transactional_server_id?: number
  transactional_stream_id?: string
  marketing_server_token?: string
  marketing_server_id?: number
  marketing_stream_id?: string
  default_from_email?: string
  default_from_name?: string
  default_reply_to?: string
}

export default function SuperAdminPostmarkConfig() {
  const [servers, setServers] = useState<PostmarkServer[]>([])
  const [streams, setStreams] = useState<Record<number, MessageStream[]>>({})
  const [config, setConfig] = useState<SharedConfig>({
    transactional_stream_id: 'outbound',
    marketing_stream_id: 'broadcasts',
    default_from_email: 'share@share.komunate.com',
    default_from_name: 'Komunate Platform',
    default_reply_to: 'noreply@komunate.com'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingStreams, setFetchingStreams] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchServersAndConfig()
  }, [])

  const fetchServersAndConfig = async () => {
    try {
      setLoading(true)
      
      // Fetch all servers from Postmark
      const serversResponse = await fetch(getApiUrl('/api/superadmin/postmark/servers'), {
        headers: {
          'x-super-admin': 'true'
        }
      })
      
      if (serversResponse.ok) {
        const data = await serversResponse.json()
        setServers(data.servers || [])
      }
      
      // Fetch current config
      const configResponse = await fetch(getApiUrl('/api/superadmin/shared-server'), {
        headers: {
          'x-super-admin': 'true'
        }
      })
      
      if (configResponse.ok) {
        const data = await configResponse.json()
        if (data.currentConfig) {
          setConfig(data.currentConfig)
        }
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err)
      setError('Failed to load Postmark servers')
    } finally {
      setLoading(false)
    }
  }

  const fetchStreamsForServer = async (serverId: number, serverToken: string) => {
    if (!serverToken) {
      setError('Server token required to fetch streams')
      return
    }

    try {
      setFetchingStreams(serverId)
      
      const response = await fetch(getApiUrl(`/api/superadmin/postmark/streams?serverId=${serverId}&token=${serverToken}`), {
        headers: {
          'x-super-admin': 'true'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setStreams(prev => ({
          ...prev,
          [serverId]: data.streams || []
        }))
      }
    } catch (err) {
      console.error('Failed to fetch streams:', err)
      setError('Failed to fetch message streams')
    } finally {
      setFetchingStreams(null)
    }
  }

  const handleServerChange = async (type: 'transactional' | 'marketing', serverId: string) => {
    const server = servers.find(s => s.ID === parseInt(serverId))
    if (!server) return

    // Get or prompt for server token
    let token = ''
    if (server.ApiTokens && server.ApiTokens.length > 0) {
      token = server.ApiTokens[0]
    } else {
      token = prompt(`Enter API token for server "${server.Name}":`) || ''
      if (!token) return
    }

    // Update config
    if (type === 'transactional') {
      setConfig(prev => ({
        ...prev,
        transactional_server_id: server.ID,
        transactional_server_token: token
      }))
    } else {
      setConfig(prev => ({
        ...prev,
        marketing_server_id: server.ID,
        marketing_server_token: token
      }))
    }

    // Fetch streams for this server
    await fetchStreamsForServer(server.ID, token)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(getApiUrl('/api/superadmin/shared-server'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-super-admin': 'true'
        },
        body: JSON.stringify({
          server_token: config.transactional_server_token,
          server_id: config.transactional_server_id,
          transactional_stream_id: config.transactional_stream_id,
          marketing_stream_id: config.marketing_stream_id,
          marketing_server_token: config.marketing_server_token,
          marketing_server_id: config.marketing_server_id,
          default_from_email: config.default_from_email,
          default_from_name: config.default_from_name,
          default_reply_to: config.default_reply_to
        })
      })

      if (response.ok) {
        setSuccess('Shared server configuration saved successfully!')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save configuration')
      }
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-2xl font-bold mb-6">Shared Email Server Configuration</h2>
        
        {/* Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">ℹ️ Default Server Setup</h3>
          <p className="text-sm text-blue-700">
            Configure the default shared servers that all free-tier tenants will use. 
            Premium tenants can activate their own dedicated servers.
          </p>
        </div>

        {/* Transactional Server */}
        <div className="border-2 border-gray-300 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-lg mb-4">📧 Transactional Emails</h3>
          <p className="text-sm text-gray-600 mb-4">
            For system emails, password resets, order confirmations (no tracking for better deliverability)
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Server</label>
              <select
                value={config.transactional_server_id || ''}
                onChange={(e) => handleServerChange('transactional', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black rounded-md"
              >
                <option value="">Select server...</option>
                {servers.map(server => (
                  <option key={server.ID} value={server.ID}>
                    {server.Name} {server.TrackOpens === false && '(No tracking ✓)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Message Stream</label>
              <select
                value={config.transactional_stream_id || 'outbound'}
                onChange={(e) => setConfig({ ...config, transactional_stream_id: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md"
                disabled={!config.transactional_server_id || fetchingStreams === config.transactional_server_id}
              >
                <option value="outbound">outbound (default)</option>
                {streams[config.transactional_server_id || 0]?.map(stream => (
                  <option key={stream.ID} value={stream.ID}>
                    {stream.Name} ({stream.MessageStreamType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {config.transactional_server_token && (
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Server Token</label>
              <input
                type="password"
                value={config.transactional_server_token}
                onChange={(e) => setConfig({ ...config, transactional_server_token: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md font-mono text-sm"
                placeholder="Server API token"
              />
            </div>
          )}
        </div>

        {/* Marketing Server */}
        <div className="border-2 border-gray-300 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-lg mb-4">📢 Marketing Emails</h3>
          <p className="text-sm text-gray-600 mb-4">
            For campaigns, newsletters, promotional emails (tracking enabled for analytics)
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Server</label>
              <select
                value={config.marketing_server_id || ''}
                onChange={(e) => handleServerChange('marketing', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black rounded-md"
              >
                <option value="">Select server...</option>
                {servers.map(server => (
                  <option key={server.ID} value={server.ID}>
                    {server.Name} {server.TrackOpens && '(Tracking enabled ✓)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Message Stream</label>
              <select
                value={config.marketing_stream_id || 'broadcasts'}
                onChange={(e) => setConfig({ ...config, marketing_stream_id: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md"
                disabled={!config.marketing_server_id || fetchingStreams === config.marketing_server_id}
              >
                <option value="broadcasts">broadcasts (default)</option>
                {streams[config.marketing_server_id || 0]?.map(stream => (
                  <option key={stream.ID} value={stream.ID}>
                    {stream.Name} ({stream.MessageStreamType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {config.marketing_server_token && (
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Server Token</label>
              <input
                type="password"
                value={config.marketing_server_token}
                onChange={(e) => setConfig({ ...config, marketing_server_token: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md font-mono text-sm"
                placeholder="Server API token"
              />
            </div>
          )}
        </div>

        {/* Default Sender Configuration */}
        <div className="border-2 border-gray-300 rounded-lg p-4 mb-4">
          <h3 className="font-bold text-lg mb-4">✉️ Default Sender Details</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">From Email</label>
              <input
                type="email"
                value={config.default_from_email}
                onChange={(e) => setConfig({ ...config, default_from_email: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md"
                placeholder="share@share.komunate.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">From Name</label>
              <input
                type="text"
                value={config.default_from_name}
                onChange={(e) => setConfig({ ...config, default_from_name: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md"
                placeholder="Komunate Platform"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reply-To Email</label>
              <input
                type="email"
                value={config.default_reply_to}
                onChange={(e) => setConfig({ ...config, default_reply_to: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md"
                placeholder="noreply@komunate.com"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !config.transactional_server_id || !config.marketing_server_id}
            className={`px-6 py-2 border-2 border-black font-medium rounded-md transition-all ${
              saving || !config.transactional_server_id || !config.marketing_server_id
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-green-400 hover:bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {saving ? 'Saving...' : '💾 Save Configuration'}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-4 bg-red-50 border-2 border-red-500 text-red-700 p-4 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mt-4 bg-green-50 border-2 border-green-500 text-green-700 p-4 rounded-md">
            {success}
          </div>
        )}
      </div>
    </div>
  )
}