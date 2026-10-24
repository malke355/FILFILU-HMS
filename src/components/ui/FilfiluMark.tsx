import { cn } from '@/lib/cn'

/** Heart + cross mark from the Filfilu Hospital artwork. */
export function FilfiluMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 44" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="filfilu-mark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="6" r="5" fill="url(#filfilu-mark-grad)" />
      <path
        d="M24 42C12 33 4 26 4 17.5 4 11.5 8.6 7 14.3 7c4 0 7.3 2.2 9.7 5.6C26.4 9.2 29.7 7 33.7 7 39.4 7 44 11.5 44 17.5 44 26 36 33 24 42Z"
        fill="url(#filfilu-mark-grad)"
      />
      <path d="M21.5 17h5v5h5v5h-5v5h-5v-5h-5v-5h5z" fill="#fff" />
    </svg>
  )
}
