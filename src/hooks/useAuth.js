'use client'
import { useState, useEffect } from 'react'
import { supabase, getProfile } from '@/lib/supabaseClient'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        try {
          const p = await getProfile(session.user.id)
          setProfile(p)
        } catch (_) {}
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        setUser(session.user)
        try {
          const p = await getProfile(session.user.id)
          setProfile(p)
        } catch (_) {}
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, loading }
}
