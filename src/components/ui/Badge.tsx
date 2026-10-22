import { cn } from '@/lib/cn'

const tones = {
  navy: 'bg-navy-900/10 text-navy-900',
  teal: 'bg-teal-50 text-teal-600 ring-1 ring-teal-600/20',
  ok: 'bg-emerald-50 text-ok-600',
  warn: 'bg-amber-50 text-warn-600',
  danger: 'bg-red-50 text-danger-600',
  muted: 'bg-slate-100 text-ink-500',
} as const

export function Badge({
  children,
  tone = 'navy',
  className,
}: {
  children: React.ReactNode
  tone?: keyof typeof tones
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
