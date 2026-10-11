'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/backend/data/client'
import type { Company } from '@/shared/companies'
import { signInCommander } from '@/backend/data/auth'

/** Tracks whether a commander is signed in and exposes sign-in/out for `company`. */
export function useAuth(company: Company) {
  const [isCommander, setIsCommander] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsCommander(!!data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsCommander(!!session)
    })

    return () => subscription.unsubscribe()
  }, [company])

  /** Signs in with the company commander password; resolves to the auth error, or null. */
  const signIn = (password: string) => signInCommander(company, password)

  /** Ends the Supabase session. */
  async function signOut() {
    await supabase.auth.signOut()
  }

  return { isCommander, loading, signIn, signOut }
}
