import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import heroImage from '@/assets/filfilu-login.jpg'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/cn'
import { patientService } from '@/services/patientService'
import { staffService } from '@/services/staffService'
import type { UserRole } from '@/types'

const destinations: Record<UserRole, string> = {
  admin: '/admin',
  doctor: '/doctor',
  nurse: '/nurse',
  patient: '/patient',
}

const DEMO_HINT = 'admin@filfilu.demo · helen.tesfaye@filfilu.demo · rahel.abebe@filfilu.demo · amina@filfilu.demo'

function FilfiluMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 44" className={className} aria-hidden>
      <defs>
        <linearGradient id="filfilu-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="6" r="5" fill="url(#filfilu-mark)" />
      <path
        d="M24 42C12 33 4 26 4 17.5 4 11.5 8.6 7 14.3 7c4 0 7.3 2.2 9.7 5.6C26.4 9.2 29.7 7 33.7 7 39.4 7 44 11.5 44 17.5 44 26 36 33 24 42Z"
        fill="url(#filfilu-mark)"
      />
      <path d="M21.5 17h5v5h5v5h-5v5h-5v-5h-5v-5h5z" fill="#fff" />
    </svg>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#fff"
        d="M15.1 15.5l.5-3.5h-3.3V9.8c0-1 .5-1.9 2-1.9h1.5v-3s-1.4-.2-2.7-.2c-2.8 0-4.6 1.7-4.6 4.7V12H5.4v3.5h3.1V24h3.8v-8.5h2.8Z"
      />
    </svg>
  )
}

/**
 * Sized entirely in `em` so the same form can scale with the hero image
 * (font-size tied to container width) or render at normal size on mobile.
 */
function LoginForm() {
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setInfo(null)
    const normalized = email.trim().toLowerCase()
    if (!normalized || !password) {
      setError('Please enter your email and password.')
      return
    }
    const member = staffService.list().find((s) => s.email.toLowerCase() === normalized)
    if (member) {
      if (!member.active) {
        setError('This account is inactive. Please contact the hospital admin.')
        return
      }
      loginAs(member.role, member.id)
      navigate(destinations[member.role])
      return
    }
    const patient = patientService.list().find((p) => p.email.toLowerCase() === normalized)
    if (patient) {
      loginAs('patient', patient.id)
      navigate(destinations.patient)
      return
    }
    setError(`No account found. Try a demo account: ${DEMO_HINT}`)
  }

  const socialLogin = () => {
    loginAs('patient')
    navigate(destinations.patient)
  }

  const field =
    'w-full rounded-[0.5em] border border-slate-200 bg-slate-50/60 py-[0.75em] pl-[2.6em] pr-[0.9em] text-[0.82em] text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-[0.25em] focus:ring-blue-500/15'

  return (
    <div className="flex h-full flex-col rounded-[1em] bg-white px-[1.5em] pb-[1.1em] pt-[1.3em] text-slate-900 shadow-[0_1.5em_3em_-1em_rgb(15_23_42_/_0.35)]">
      <div className="flex items-center justify-center gap-[0.5em]">
        <FilfiluMark className="h-[2.6em] w-[2.8em]" />
        <div className="leading-none">
          <p className="text-[1.45em] font-extrabold tracking-tight text-blue-900">FILFILU</p>
          <p className="mt-[0.1em] text-[0.95em] font-bold tracking-[0.12em] text-teal-600">
            HOSPITAL
          </p>
        </div>
      </div>

      <h1 className="mt-[0.8em] text-center text-[1.55em] font-bold tracking-tight text-blue-950">
        Welcome Back
      </h1>
      <p className="mt-[0.2em] text-center text-[0.78em] text-slate-500">
        Please enter your details below to continue
      </p>

      <form onSubmit={onSubmit} className="mt-[1.1em] flex flex-1 flex-col" noValidate>
        <label htmlFor="login-email" className="text-[0.82em] font-semibold text-slate-800">
          E-mail
        </label>
        <div className="relative mt-[0.35em]">
          <Mail className="pointer-events-none absolute left-[0.85em] top-1/2 h-[1em] w-[1em] -translate-y-1/2 text-slate-400" />
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            className={field}
          />
        </div>

        <label
          htmlFor="login-password"
          className="mt-[0.8em] text-[0.82em] font-semibold text-slate-800"
        >
          Password
        </label>
        <div className="relative mt-[0.35em]">
          <Lock className="pointer-events-none absolute left-[0.85em] top-1/2 h-[1em] w-[1em] -translate-y-1/2 text-slate-400" />
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            className={cn(field, 'pr-[2.6em]')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-[0.7em] top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
          >
            {showPassword ? (
              <EyeOff className="h-[1.05em] w-[1.05em]" />
            ) : (
              <Eye className="h-[1.05em] w-[1.05em]" />
            )}
          </button>
        </div>

        <div className="mt-[0.75em] flex items-center justify-between text-[0.72em]">
          <label className="inline-flex cursor-pointer items-center gap-[0.5em] text-slate-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-[1.15em] w-[1.15em] rounded border-slate-300 accent-blue-600"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setInfo('Please contact the hospital admin desk to reset your password.')
            }}
            className="font-semibold text-blue-600 hover:text-blue-800"
          >
            Forgot your password?
          </button>
        </div>

        {error || info ? (
          <p
            role={error ? 'alert' : 'status'}
            className={cn(
              'mt-[0.6em] rounded-[0.5em] px-[0.8em] py-[0.5em] text-[0.66em] leading-snug',
              error ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700',
            )}
          >
            {error ?? info}
          </p>
        ) : null}

        <button
          type="submit"
          className="mt-[0.9em] inline-flex w-full items-center justify-center gap-[0.5em] rounded-[0.55em] bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 py-[0.75em] text-[0.95em] font-semibold text-white shadow-[0_0.6em_1.2em_-0.5em_rgb(37_99_235_/_0.6)] transition hover:brightness-110 active:scale-[0.99]"
        >
          <ArrowRight className="h-[1.05em] w-[1.05em]" /> Login
        </button>

        <div className="my-[0.8em] flex items-center gap-[0.8em] text-[0.65em] font-medium text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          OR
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-[0.5em]">
          <button
            type="button"
            onClick={socialLogin}
            className="flex w-full items-center justify-center gap-[0.6em] rounded-[0.5em] border border-slate-200 bg-white py-[0.6em] text-[0.78em] font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <GoogleIcon className="h-[1.15em] w-[1.15em]" /> Sign in with Google
          </button>
          <button
            type="button"
            onClick={socialLogin}
            className="flex w-full items-center justify-center gap-[0.6em] rounded-[0.5em] border border-slate-200 bg-white py-[0.6em] text-[0.78em] font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <FacebookIcon className="h-[1.15em] w-[1.15em]" /> Sign in with Facebook
          </button>
        </div>

        <p className="mt-auto pt-[0.8em] text-center text-[0.72em] text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/doctors" className="font-semibold text-blue-600 hover:text-blue-800">
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  )
}

export function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <img
        src={heroImage}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
      />

      {/* Desktop/tablet: the artwork at its true aspect ratio with the live form over its drawn card */}
      <div className="relative hidden min-h-screen items-center justify-center md:flex">
        <div
          className="relative aspect-[1024/682] w-[min(100vw,calc(100vh*1024/682))] shadow-2xl [container-type:inline-size]"
        >
          <img
            src={heroImage}
            alt="Filfilu Hospital — From clinically to one place. Better care, brighter tomorrow."
            className="absolute inset-0 h-full w-full select-none object-cover"
            draggable={false}
          />
          <div
            className="absolute text-[1.14cqw]"
            style={{ left: '68.9%', top: '17.4%', width: '27.6%', height: '63.4%' }}
          >
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Mobile: artwork on top, form below at normal size */}
      <div className="relative md:hidden">
        <img
          src={heroImage}
          alt="Filfilu Hospital — From clinically to one place."
          className="w-full object-cover object-left"
          style={{ aspectRatio: '700 / 682' }}
        />
        <div className="relative -mt-10 px-4 pb-10 text-[15px]">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
