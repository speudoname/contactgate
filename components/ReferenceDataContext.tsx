'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import type { ReferenceData } from '@/types'

interface ReferenceDataContextType {
  referenceData: ReferenceData
  loading: boolean
  error: string
  refetch: () => Promise<void>
}

const ReferenceDataContext = createContext<ReferenceDataContextType | undefined>(undefined)

interface ReferenceDataProviderProps {
  children: ReactNode
}

export function ReferenceDataProvider({ children }: ReferenceDataProviderProps) {
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    lifecycleStages: [],
    sources: [],
    tags: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchReferenceData = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(getApiUrl('/api/reference-data'))
      if (response.ok) {
        const data = await response.json()
        setReferenceData(data)
      } else {
        setError('Failed to fetch reference data')
      }
    } catch (err) {
      console.error('Failed to fetch reference data:', err)
      setError('Failed to fetch reference data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReferenceData()
  }, [])

  const value = {
    referenceData,
    loading,
    error,
    refetch: fetchReferenceData
  }

  return (
    <ReferenceDataContext.Provider value={value}>
      {children}
    </ReferenceDataContext.Provider>
  )
}

export function useReferenceData() {
  const context = useContext(ReferenceDataContext)
  if (context === undefined) {
    throw new Error('useReferenceData must be used within a ReferenceDataProvider')
  }
  return context
}
