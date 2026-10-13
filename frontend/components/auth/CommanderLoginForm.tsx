'use client'

import { useState, useEffect, useRef } from 'react'
import { track } from '@vercel/analytics'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/fields'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

/** localStorage key holding the login cooldown for a company. */
function storageKey(label: string) {
  return `login_cooldown_${label.toLowerCase()}`
}

/** Reads the saved failed-attempt count and lockout expiry; defaults when absent or corrupt. */
function readCooldown(label: string): { attempts: number; lockedUntil: number | null } {
  try {
    const raw = localStorage.getItem(storageKey(label))
    if (raw) return JSON.parse(raw)
  } catch {}
  return { attempts: 0, lockedUntil: null }
}

/** Persists the failed-attempt count and lockout expiry. */
function saveCooldown(label: string, data: { attempts: number; lockedUntil: number | null }) {
  localStorage.setItem(storageKey(label), JSON.stringify(data))
}

/** Forgets the cooldown after a successful login. */
function clearCooldown(label: string) {
  localStorage.removeItem(storageKey(label))
}

/** Commander password form with a client-side lockout after repeated failures. */
export default function CommanderLoginForm({
  companyLabel,
  onSignIn,
}: {
  companyLabel: string
  onSignIn: (password: string) => Promise<{ message: string } | null>
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** Starts a once-a-second countdown until `lockedUntil` (epoch ms). */
  function startCountdown(lockedUntil: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    /** Updates the remaining lockout seconds; stops at zero. */
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setCountdown(0)
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        setCountdown(remaining)
      }
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
  }

  useEffect(() => {
    const { lockedUntil } = readCooldown(companyLabel)
    if (lockedUntil && lockedUntil > Date.now()) {
      startCountdown(lockedUntil)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [companyLabel])

  const isLocked = countdown > 0

  /** Signs in; on failure counts the attempt and locks out after MAX_ATTEMPTS. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLocked || loading || !password) return
    setLoading(true)
    setError(null)
    const err = await onSignIn(password)
    if (err) {
      const current = readCooldown(companyLabel)
      const newAttempts = current.attempts + 1
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000
        saveCooldown(companyLabel, { attempts: 0, lockedUntil })
        startCountdown(lockedUntil)
        setError(null)
      } else {
        saveCooldown(companyLabel, { attempts: newAttempts, lockedUntil: null })
        const left = MAX_ATTEMPTS - newAttempts
        setError(`Incorrect password. ${left} attempt${left === 1 ? '' : 's'} remaining.`)
      }
      setLoading(false)
    } else {
      clearCooldown(companyLabel)
      track('login', { company: companyLabel.toLowerCase() })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left" aria-label={`${companyLabel} commander sign in`}>
      <label htmlFor="commander-password" className="sr-only">Commander password</label>
      <div className="flex gap-2">
        <Input
          id="commander-password"
          type="password"
          placeholder={isLocked ? `Try again in ${countdown}s` : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLocked || loading}
          autoFocus
          autoComplete="current-password"
          aria-invalid={!!error}
          aria-describedby="commander-password-status"
          className="w-auto min-w-0 flex-1 rounded-pill px-5"
        />
        <Button type="submit" className="shrink-0" disabled={isLocked || loading || !password}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </div>
      <div id="commander-password-status" role="status" className="min-h-5 px-5 text-sm">
        {error && <p className="text-danger">{error}</p>}
        {isLocked && <p className="text-ink-80">Too many attempts. Try again in {countdown}s.</p>}
      </div>
    </form>
  )
}
