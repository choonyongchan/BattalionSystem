import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAuth } from '@/lib/useAuth'

const unsubscribe = vi.fn()
let authChangeCallback: (event: string, session: unknown) => void = () => {}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn((cb: typeof authChangeCallback) => {
        authChangeCallback = cb
        return { data: { subscription: { unsubscribe } } }
      }),
      signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
      signOut: vi.fn(() => Promise.resolve()),
    },
  },
}))

import { supabase } from '@/lib/supabase'

beforeEach(() => vi.clearAllMocks())

describe('useAuth', () => {
  it('signIn builds the synthetic company email', async () => {
    const { result } = renderHook(() => useAuth('stallion' as any))
    await act(async () => { await result.current.signIn('pw') })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'stallion@40sar.internal', password: 'pw' })
  })

  it('isCommander reflects an existing session on mount', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: {} } } as any)
    const { result } = renderHook(() => useAuth('stallion' as any))
    await waitFor(() => expect(result.current.isCommander).toBe(true))
  })

  it('isCommander flips when onAuthStateChange fires', async () => {
    const { result } = renderHook(() => useAuth('stallion' as any))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => authChangeCallback('SIGNED_IN', {}))
    expect(result.current.isCommander).toBe(true)
    act(() => authChangeCallback('SIGNED_OUT', null))
    expect(result.current.isCommander).toBe(false)
  })

  it('unsubscribes on unmount', async () => {
    const { unmount, result } = renderHook(() => useAuth('stallion' as any))
    await waitFor(() => expect(result.current.loading).toBe(false))
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('signOut calls supabase signOut', async () => {
    const { result } = renderHook(() => useAuth('stallion' as any))
    await act(async () => { await result.current.signOut() })
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
