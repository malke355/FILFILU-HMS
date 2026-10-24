import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { ThemeProvider } from '@/features/theme/ThemeContext'
import { AppRouter } from '@/app/router'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={basename}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
