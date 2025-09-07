'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import { useReferenceData } from './ReferenceDataContext'
import EventsTimeline from './EventsTimeline'
import type { Contact, ReferenceData } from '@/types'

interface ViewEditContactModalProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function ViewEditContactModal({ contact, isOpen, onClose, onUpdate }: ViewEditContactModalProps) {
  const { referenceData } = useReferenceData()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    email: contact.email || '',
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    phone: contact.phone || '',
    lifecycle_stage: contact.lifecycle_stage || 'subscriber',
    source: contact.source || 'manual',
    email_opt_in: contact.email_opt_in || false,
    notes: contact.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>(contact.tags || [])

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(getApiUrl(`/api/contacts/${contact.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Failed to update contact: ${errorData}`)
      }

      setIsEditing(false)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      email: contact.email || '',
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      phone: contact.phone || '',
      lifecycle_stage: contact.lifecycle_stage || 'subscriber',
      source: contact.source || 'manual',
      email_opt_in: contact.email_opt_in || false,
      notes: contact.notes || ''
    })
    setIsEditing(false)
    setError('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b-2 border-black flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Edit Contact' : 'Contact Details'}
          </h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-blue-400 hover:bg-blue-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              Edit
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
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
              {isEditing ? (
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="px-3 py-2">{contact.first_name || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="px-3 py-2">{contact.last_name || '-'}</p>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              {isEditing ? (
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="px-3 py-2">{contact.email || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="px-3 py-2">{contact.phone || '-'}</p>
              )}
            </div>
          </div>


          {/* CRM Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lifecycle Stage
              </label>
              {isEditing ? (
                <select
                  value={formData.lifecycle_stage}
                  onChange={(e) => setFormData({ ...formData, lifecycle_stage: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {referenceData.lifecycleStages.length > 0 ? (
                    referenceData.lifecycleStages.map(stage => (
                      <option key={stage.id} value={stage.name}>
                        {stage.display_name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="subscriber">Subscriber</option>
                      <option value="lead">Lead</option>
                      <option value="customer">Customer</option>
                    </>
                  )}
                </select>
              ) : (
                <p className="px-3 py-2">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {contact.lifecycle_stage}
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Score
              </label>
              <p className="px-3 py-2">{contact.lead_score}</p>
            </div>
          </div>

          {/* Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              {isEditing ? (
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {referenceData.sources.length > 0 ? (
                    referenceData.sources.map(source => (
                      <option key={source.id} value={source.name}>
                        {source.display_name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="manual">Manual Entry</option>
                      <option value="website">Website</option>
                      <option value="import">Import</option>
                    </>
                  )}
                </select>
              ) : (
                <p className="px-3 py-2">{contact.source || '-'}</p>
              )}
            </div>
            <div></div>
          </div>

          {/* Tags */}
          {isEditing && (
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
          )}

          {!isEditing && contact.tags && contact.tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            {isEditing ? (
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="px-3 py-2 whitespace-pre-wrap">{contact.notes || '-'}</p>
            )}
          </div>

          {/* Marketing Opt-ins */}
          <div className="space-y-2">
            <div className="flex items-center">
              {isEditing ? (
                <>
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
                </>
              ) : (
                <p className="text-sm text-gray-700">
                  Email opt-in: {contact.email_opt_in ? 'Yes' : 'No'}
                </p>
              )}
            </div>
          </div>

          {/* Metadata */}
          {!isEditing && (
            <div className="pt-4 border-t-2 border-gray-200 space-y-2 text-sm text-gray-600">
              <p>Created: {new Date(contact.created_at).toLocaleString()}</p>
              {contact.updated_at && (
                <p>Updated: {new Date(contact.updated_at).toLocaleString()}</p>
              )}
              {contact.last_activity_at && (
                <p>Last Activity: {new Date(contact.last_activity_at).toLocaleString()}</p>
              )}
            </div>
          )}

          {/* Events Timeline */}
          {!isEditing && (
            <div className="pt-4 border-t-2 border-gray-200">
              <EventsTimeline contactId={contact.id} isOpen={isOpen} />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-gray-200">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-green-400 hover:bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}