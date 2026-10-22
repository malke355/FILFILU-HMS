import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { LoginPage } from '@/pages/LoginPage'

describe('Demo login', () => {
  it('labels demo login and continues with a role', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText(/demo login/i)).toBeInTheDocument()
    expect(screen.getByText(/not security/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue with demo role/i }))
    expect(localStorage.getItem('filfilu-demo-session')).toContain('admin')
  })
})
