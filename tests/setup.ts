import dotenv from 'dotenv'
dotenv.config({ path: '.env.test' })

// Node.js 22 ships a stub localStorage that is undefined unless --localstorage-file is
// passed, which shadows jsdom's working implementation. Polyfill here so tests that call
// localStorage.clear() / setItem don't throw.
if (typeof localStorage === 'undefined') {
  let store: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v) },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
      get length() { return Object.keys(store).length },
      key: (i: number) => Object.keys(store)[i] ?? null,
    } as Storage,
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement scrollIntoView; stub it to avoid unhandled errors
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.scrollIntoView = () => {}
}

import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}))
