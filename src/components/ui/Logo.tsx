import { cn } from '@/lib/cn'
import { FilfiluMark } from './FilfiluMark'

export function Logo({
  className,
  light = false,
  showTagline = false,
}: {
  className?: string
  light?: boolean
  showTagline?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <FilfiluMark className="h-9 w-10" />
      <span className="leading-none">
        <span
          className={cn(
            'block font-display text-lg font-extrabold tracking-tight',
            light ? 'text-white' : 'text-blue-900',
          )}
        >
          FILFILU
          <span className={cn('ml-1 font-bold', light ? 'text-teal-300' : 'text-teal-600')}>
            HOSPITAL
          </span>
        </span>
        {showTagline ? (
          <span
            className={cn(
              'mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em]',
              light ? 'text-white/70' : 'text-ink-500',
            )}
          >
            Health · Care · Together
          </span>
        ) : null}
      </span>
    </span>
  )
}
