'use client'

import { useState, useEffect, useRef } from 'react'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

function storageKey(label: string) {
  return `login_cooldown_${label.toLowerCase()}`
}

function readCooldown(label: string): { attempts: number; lockedUntil: number | null } {
  try {
    const raw = localStorage.getItem(storageKey(label))
    if (raw) return JSON.parse(raw)
  } catch {}
  return { attempts: 0, lockedUntil: null }
}

function saveCooldown(label: string, data: { attempts: number; lockedUntil: number | null }) {
  localStorage.setItem(storageKey(label), JSON.stringify(data))
}

function clearCooldown(label: string) {
  localStorage.removeItem(storageKey(label))
}

export default function LoginModal({
  companyLabel,
  onSignIn,
  onClose,
}: {
  companyLabel: string
  onSignIn: (password: string) => Promise<{ message: string } | null>
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCountdown(lockedUntil: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
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
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Login Here as</p>
        <h2 className="text-xl font-bold text-gray-900 mb-5">{companyLabel} Commander</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLocked}
            autoFocus
            className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          {isLocked && (
            <p className="text-amber-600 text-xs">Too many attempts. Try again in {countdown}s.</p>
          )}
          <button
            type="submit"
            disabled={loading || isLocked || !password}
            className="w-full py-3 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : isLocked ? `Try again in ${countdown}s` : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
