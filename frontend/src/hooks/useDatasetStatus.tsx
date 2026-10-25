import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import type { DatasetStatus } from '../types'

export function useDatasetStatus() {
  const [status, setStatus] = useState<DatasetStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.datasetStatus()
      setStatus(data)
    } catch {
      setStatus({ loaded: false, message: 'Backend unavailable.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { status, loading, refresh }
}
