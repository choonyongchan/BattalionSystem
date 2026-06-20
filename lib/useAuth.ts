'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from './supabase'
import type { Company } from './companies'

export function useAuth(company: Company) {
  const [isCommander, setIsCommander] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseClient(company)

    supabase.auth.getSession().then(({ data }) => {
      setIsCommander(!!data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsCommander(!!session)
    })

    return () => subscription.unsubscribe()
  }, [company])

  async function signIn(password: string) {
    const email = `${company}@40sar.internal`
    const { error } = await getSupabaseClient(company).auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await getSupabaseClient(company).auth.signOut()
  }

  return { isCommander, loading, signIn, signOut }
}
