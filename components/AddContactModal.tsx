'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import type { ReferenceData } from '@/types'

interface AddContactModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddContactModal({ isOpen, onClose, onSuccess }: AddContactModalProps) {
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    lifecycleStages: [],
    sources: [],
    tags: []
  })
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    company: '',
    job_title: '',
    website: '',
    lifecycle_stage: 'subscriber',
    source: 'manual',
    email_opt_in: false,
    sms_opt_in: false,
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      fetchReferenceData()
    }
  }, [isOpen])

  const fetchReferenceData = async () => {
    try {
      const response = await fetch(getApiUrl('/api/reference-data'))
      if (response.ok) {
        const data = await response.json()
        setReferenceData(data)
        // Set default values if available
        if (data.lifecycleStages.length > 0) {
          setFormData(prev => ({ ...prev, lifecycle_stage: data.lifecycleStages[0].name }))
        }
        if (data.sources.length > 0) {
          setFormData(prev => ({ ...prev, source: data.sources[0].name }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch reference data:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(getApiUrl('/api/contacts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Failed to create contact: ${errorData}`)
      }

      // Reset form
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        company: '',
        job_title: '',
        website: '',
        lifecycle_stage: 'subscriber',
        source: 'manual',
        email_opt_in: false,
        sms_opt_in: false,
        notes: ''
      })
      
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b-2 border-black">
          <h2 className="text-2xl font-bold">Add New Contact</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border-2 border-red-400 rounded text-red-700">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Professional Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com"
            />
          </div>

          {/* CRM Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lifecycle Stage
              </label>
              <select
                value={formData.lifecycle_stage}
                onChange={(e) => setFormData({ ...formData, lifecycle_stage: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {referenceData.lifecycleStages.map(stage => (
                  <option key={stage.id} value={stage.name}>
                    {stage.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {referenceData.sources.map(source => (
                  <option key={source.id} value={source.name}>
                    {source.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 p-3 border-2 border-black rounded-md min-h-[60px]">
              {referenceData.tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    if (selectedTags.includes(tag.id)) {
                      setSelectedTags(selectedTags.filter(t => t !== tag.id))
                    } else {
                      setSelectedTags([...selectedTags, tag.id])
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium border-2 transition-all ${
                    selectedTags.includes(tag.id)
                      ? 'border-black bg-blue-400 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-black'
                  }`}
                  style={{
                    backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined
                  }}
                >
                  {tag.name}
                </button>
              ))}
              {referenceData.tags.length === 0 && (
                <span className="text-gray-400 text-sm">No tags configured</span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Marketing Opt-ins */}
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="email_opt_in"
                checked={formData.email_opt_in}
                onChange={(e) => setFormData({ ...formData, email_opt_in: e.target.checked })}
                className="h-4 w-4 border-2 border-black rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="email_opt_in" className="ml-2 text-sm text-gray-700">
                Email marketing opt-in
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sms_opt_in"
                checked={formData.sms_opt_in}
                onChange={(e) => setFormData({ ...formData, sms_opt_in: e.target.checked })}
                className="h-4 w-4 border-2 border-black rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="sms_opt_in" className="ml-2 text-sm text-gray-700">
                SMS marketing opt-in
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-green-400 hover:bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}