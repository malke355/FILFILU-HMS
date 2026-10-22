import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthContext'
import { AppRouter } from '@/app/router'

export default function App() {
  return (
    <BrowserRouter basename="/FILFILU-HMS">
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  )
}
