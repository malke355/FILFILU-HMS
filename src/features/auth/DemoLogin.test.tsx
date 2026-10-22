import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ThemeProvider } from '@/features/theme/ThemeContext'
import { LoginPage } from '@/pages/LoginPage'

function renderLogin() {
  render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
  // The page renders a desktop and a mobile copy of the form; test the first.
  return within(screen.getAllByRole('heading', { name: /welcome back/i })[0]!.parentElement!)
}

describe('Login page', () => {
  it('signs a staff member in by email', async () => {
    const user = userEvent.setup()
    const form = renderLogin()

    await user.type(form.getByLabelText(/e-mail/i), 'rahel.abebe@filfilu.demo')
    await user.type(form.getByLabelText(/^password$/i), 'anything')
    await user.click(form.getByRole('button', { name: /^login$/i }))
    expect(localStorage.getItem('filfilu-demo-session')).toContain('staff-nurse-1')
  })

  it('rejects unknown emails', async () => {
    localStorage.clear()
    const user = userEvent.setup()
    const form = renderLogin()

    await user.type(form.getByLabelText(/e-mail/i), 'nobody@example.com')
    await user.type(form.getByLabelText(/^password$/i), 'secret')
    await user.click(form.getByRole('button', { name: /^login$/i }))
    expect(form.getByRole('alert')).toHaveTextContent(/no account found/i)
    expect(localStorage.getItem('filfilu-demo-session')).toBeNull()
  })
})
