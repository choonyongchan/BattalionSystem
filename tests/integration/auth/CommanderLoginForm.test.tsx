import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommanderLoginForm from '@/components/auth/CommanderLoginForm'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('CommanderLoginForm', () => {
  it('shows an error message for wrong password', async () => {
    const onSignIn = vi.fn().mockResolvedValue({ message: 'Invalid login credentials' })
    render(<CommanderLoginForm companyLabel="Stallion" onSignIn={onSignIn} />)

    await userEvent.type(screen.getByPlaceholderText('Password'), 'wrongpass')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/Incorrect password/)).toBeInTheDocument()
      expect(screen.getByText(/2 attempts remaining/)).toBeInTheDocument()
    })
  })

  it('shows lockout countdown after 3 wrong attempts', async () => {
    const onSignIn = vi.fn().mockResolvedValue({ message: 'Invalid login credentials' })
    render(<CommanderLoginForm companyLabel="Stallion" onSignIn={onSignIn} />)

    for (let i = 0; i < 3; i++) {
      await userEvent.type(screen.getByPlaceholderText(/Password|Try again/), 'wrongpass')
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(onSignIn).toHaveBeenCalledTimes(i + 1))
    }

    await waitFor(() => {
      expect(screen.getByText(/Too many attempts/)).toBeInTheDocument()
    })
  })

  it('calls onSignIn with the entered password on submit', async () => {
    const onSignIn = vi.fn().mockResolvedValue(null)
    render(<CommanderLoginForm companyLabel="Stallion" onSignIn={onSignIn} />)

    await userEvent.type(screen.getByPlaceholderText('Password'), 'correctpass')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(onSignIn).toHaveBeenCalledWith('correctpass')
    })
  })
})
