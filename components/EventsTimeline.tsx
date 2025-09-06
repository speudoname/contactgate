'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'

interface Event {
  id: string
  event_type: string
  event_category: string
  source_app: string
  properties: any
  created_at: string
}

interface EventsTimelineProps {
  contactId: string
  isOpen: boolean
}

export default function EventsTimeline({ contactId, isOpen }: EventsTimelineProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (isOpen && contactId) {
      fetchEvents()
    }
  }, [isOpen, contactId])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const response = await fetch(getApiUrl(`/api/contacts/${contactId}/events`))
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setLoading(false)
    }
  }

  const getEventIcon = (eventType: string) => {
    if (eventType.startsWith('email.')) return '📧'
    if (eventType.startsWith('webinar.')) return '🎥'
    if (eventType.startsWith('course.')) return '📚'
    if (eventType.startsWith('page.')) return '📄'
    if (eventType.startsWith('contact.')) return '👤'
    return '📌'
  }

  const getEventColor = (category: string) => {
    switch (category) {
      case 'email': return 'bg-blue-100 text-blue-800'
      case 'webinar': return 'bg-purple-100 text-purple-800'
      case 'course': return 'bg-green-100 text-green-800'
      case 'page': return 'bg-yellow-100 text-yellow-800'
      case 'system': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatEventType = (eventType: string) => {
    return eventType.replace(/_/g, ' ').replace(/\./g, ' › ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(e => e.event_category === filter)

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity Timeline</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1 border-2 border-black rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Events</option>
          <option value="system">System</option>
          <option value="email">Email</option>
          <option value="webinar">Webinar</option>
          <option value="course">Course</option>
          <option value="page">Page</option>
        </select>
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No events recorded yet</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredEvents.map(event => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-black transition-colors"
            >
              <span className="text-2xl" role="img" aria-label={event.event_category}>
                {getEventIcon(event.event_type)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getEventColor(event.event_category)}`}>
                    {event.event_category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium mt-1">
                  {formatEventType(event.event_type)}
                </p>
                {event.source_app && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Source: {event.source_app}
                  </p>
                )}
                {event.properties && Object.keys(event.properties).length > 0 && (
                  <div className="text-xs text-gray-600 mt-1">
                    {Object.entries(event.properties).slice(0, 3).map(([key, value]) => (
                      <div key={key}>
                        {key}: {JSON.stringify(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}