'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchInventory, subscribeToInventory } from '@/lib/supabaseClient'

export function useInventory() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchInventory()
      setItems(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const unsubscribe = subscribeToInventory(() => load())
    return unsubscribe
  }, [load])

  return { items, loading, error, refetch: load }
}
