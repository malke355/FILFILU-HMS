import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ThemeProvider } from '@/features/theme/ThemeContext'
import { LoginPage } from '@/pages/LoginPage'

function renderLogin() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('Login page', () => {
  it('signs in with the default admin role', async () => {
    const user = userEvent.setup()
    renderLogin()

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue as admin/i }))
    expect(localStorage.getItem('filfilu-demo-session')).toContain('admin')
  })

  it('signs in with a selected role', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('radio', { name: /nurse/i }))
    await user.click(screen.getByRole('button', { name: /continue as nurse/i }))
    expect(localStorage.getItem('filfilu-demo-session')).toContain('nurse')
  })
})
