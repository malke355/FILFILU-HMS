import { Activity } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="bg-brand-gradient inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg shadow-brand-600/30">
        <Activity className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      </span>
      <span
        className={cn(
          'font-display text-xl font-extrabold tracking-tight',
          light ? 'text-white' : 'text-navy-900',
        )}
      >
        Filfilu
      </span>
    </span>
  )
}
