'use client'

import { useState } from 'react'
import { getApiUrl } from '@/lib/utils/api'

interface EmailComposerProps {
  defaultTo?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function EmailComposer({ defaultTo = '', onSuccess, onCancel }: EmailComposerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    to: defaultTo,
    subject: '',
    htmlBody: '',
    from: '',
    fromName: '',
    replyTo: '',
    serverType: 'transactional' as 'transactional' | 'marketing',
    trackOpens: false,
    trackLinks: 'None'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(getApiUrl('/api/email/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      alert(`Email sent successfully! Message ID: ${data.messageId}`)
      
      // Reset form
      setFormData({
        to: '',
        subject: '',
        htmlBody: '',
        from: '',
        fromName: '',
        replyTo: '',
        serverType: 'transactional',
        trackOpens: false,
        trackLinks: 'None'
      })

      onSuccess?.()
    } catch (err) {
      console.error('Failed to send email:', err)
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h2 className="text-xl font-bold mb-4">Send Email</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Server Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Email Type</label>
          <select
            value={formData.serverType}
            onChange={(e) => setFormData({ 
              ...formData, 
              serverType: e.target.value as 'transactional' | 'marketing',
              trackOpens: e.target.value === 'marketing',
              trackLinks: e.target.value === 'marketing' ? 'HtmlAndText' : 'None'
            })}
            className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="transactional">Transactional (No Tracking)</option>
            <option value="marketing">Marketing (With Tracking)</option>
          </select>
        </div>

        {/* To */}
        <div>
          <label className="block text-sm font-medium mb-1">To *</label>
          <input
            type="email"
            required
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            placeholder="recipient@example.com"
            className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* From */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">From Email</label>
            <input
              type="email"
              value={formData.from}
              onChange={(e) => setFormData({ ...formData, from: e.target.value })}
              placeholder="sender@example.com"
              className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">From Name</label>
            <input
              type="text"
              value={formData.fromName}
              onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
              placeholder="Sender Name"
              className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Reply To */}
        <div>
          <label className="block text-sm font-medium mb-1">Reply To</label>
          <input
            type="email"
            value={formData.replyTo}
            onChange={(e) => setFormData({ ...formData, replyTo: e.target.value })}
            placeholder="reply@example.com"
            className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium mb-1">Subject *</label>
          <input
            type="text"
            required
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Email subject"
            className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium mb-1">Message *</label>
          <textarea
            required
            value={formData.htmlBody}
            onChange={(e) => setFormData({ ...formData, htmlBody: e.target.value })}
            placeholder="Email content (HTML supported)"
            rows={8}
            className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tracking Options (for marketing) */}
        {formData.serverType === 'marketing' && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="trackOpens"
                checked={formData.trackOpens}
                onChange={(e) => setFormData({ ...formData, trackOpens: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="trackOpens" className="text-sm">Track email opens</label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Track Links</label>
              <select
                value={formData.trackLinks}
                onChange={(e) => setFormData({ ...formData, trackLinks: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="None">Don't track</option>
                <option value="HtmlAndText">Track all links</option>
                <option value="HtmlOnly">Track HTML links only</option>
                <option value="TextOnly">Track text links only</option>
              </select>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-blue-400 hover:bg-blue-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Sending...' : 'Send Email'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}