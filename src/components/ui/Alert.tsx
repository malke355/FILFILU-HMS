import { cn } from '@/lib/cn'
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

const styles = {
  info: 'border-teal-600/20 bg-teal-50 text-navy-900',
  warn: 'border-amber-500/25 bg-amber-50 text-amber-950 dark:bg-amber-500/8 dark:text-amber-200',
  danger: 'border-red-500/25 bg-red-50 text-red-950 dark:bg-red-500/8 dark:text-red-200',
  success:
    'border-emerald-500/25 bg-emerald-50 text-emerald-950 dark:bg-emerald-500/8 dark:text-emerald-200',
} as const

const icons = {
  info: Info,
  warn: AlertTriangle,
  danger: AlertTriangle,
  success: CheckCircle2,
}

export function Alert({
  children,
  tone = 'info',
  title,
  className,
}: {
  children: React.ReactNode
  tone?: keyof typeof styles
  title?: string
  className?: string
}) {
  const Icon = icons[tone]
  return (
    <div className={cn('flex gap-3 rounded-2xl border px-4 py-3 text-sm', styles[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
        <div className="text-ink-700">{children}</div>
      </div>
    </div>
  )
}
