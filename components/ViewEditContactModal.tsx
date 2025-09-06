'use client'

import { useState } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import EventsTimeline from './EventsTimeline'
import type { Contact } from '@/types'

interface ViewEditContactModalProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function ViewEditContactModal({ contact, isOpen, onClose, onUpdate }: ViewEditContactModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    email: contact.email || '',
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    phone: contact.phone || '',
    company: contact.company || '',
    job_title: contact.job_title || '',
    lifecycle_stage: contact.lifecycle_stage || 'subscriber',
    source: contact.source || 'manual',
    email_opt_in: contact.email_opt_in || false,
    notes: contact.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      company: contact.company || '',
      job_title: contact.job_title || '',
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

          {/* Professional Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="px-3 py-2">{contact.company || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="px-3 py-2">{contact.job_title || '-'}</p>
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
                  <option value="subscriber">Subscriber</option>
                  <option value="lead">Lead</option>
                  <option value="marketing_qualified_lead">Marketing Qualified Lead</option>
                  <option value="sales_qualified_lead">Sales Qualified Lead</option>
                  <option value="opportunity">Opportunity</option>
                  <option value="customer">Customer</option>
                  <option value="evangelist">Evangelist</option>
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

          {/* Email Opt-in */}
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