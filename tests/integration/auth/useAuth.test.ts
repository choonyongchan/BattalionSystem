import { describe, it, expect, afterAll } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAuth } from '@/frontend/hooks/useAuth'
import { commanderEmail } from '@/backend/data/auth'
import { supabase } from '@/backend/data/client'

// Real Supabase auth against the test company's commander account — no mocks
afterAll(() => supabase.auth.signOut())

describe('useAuth', () => {
  it('maps a company to its shared commander login', () => {
    expect(commanderEmail('test')).toBe('test@40sar.internal')
    expect(process.env.TEST_SUPABASE_EMAIL).toBe(commanderEmail('test'))
  })

  it('rejects a wrong password and stays signed out', async () => {
    await supabase.auth.signOut()
    const { result } = renderHook(() => useAuth('test'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let error: unknown
    await act(async () => { error = await result.current.signIn('definitely-not-the-password') })
    expect(error).not.toBeNull()
    expect(result.current.isCommander).toBe(false)
  })

  it('signs in with the right password, then signs out', async () => {
    const { result } = renderHook(() => useAuth('test'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { expect(await result.current.signIn(process.env.TEST_SUPABASE_PASSWORD!)).toBeNull() })
    await waitFor(() => expect(result.current.isCommander).toBe(true))
    await act(() => result.current.signOut())
    await waitFor(() => expect(result.current.isCommander).toBe(false))
  })
})
