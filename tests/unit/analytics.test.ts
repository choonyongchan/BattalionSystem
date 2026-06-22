import { describe, it, expect, vi } from 'vitest'
import { trackEvent } from '@/lib/analytics'
import { track } from '@vercel/analytics'

describe('trackEvent', () => {
  it('calls vercel track with the event name and props', () => {
    trackEvent('login', { company: 'stallion' })
    expect(track).toHaveBeenCalledWith('login', { company: 'stallion' })
  })

  it('calls vercel track for parade_state_generated', () => {
    trackEvent('parade_state_generated', { company: 'stallion', soldierCount: 5, date: '2026-01-15', paradeType: 'First Parade' })
    expect(track).toHaveBeenCalledWith('parade_state_generated', {
      company: 'stallion',
      soldierCount: 5,
      date: '2026-01-15',
      paradeType: 'First Parade',
    })
  })
})
