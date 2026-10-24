import { cn } from '@/lib/cn'

const tones = {
  navy: 'bg-navy-900/8 text-navy-900',
  teal: 'bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-600/20',
  ok: 'bg-emerald-50 text-ok-600 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10',
  warn: 'bg-amber-50 text-warn-600 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-500/10',
  danger: 'bg-red-50 text-danger-600 ring-1 ring-inset ring-red-600/15 dark:bg-red-500/10',
  muted: 'bg-surface-2 text-ink-500',
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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
