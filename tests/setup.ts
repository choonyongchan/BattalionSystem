import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}))
