import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-md shadow-brand-600/25 hover:shadow-lg hover:shadow-brand-600/30 hover:brightness-110',
  secondary: 'bg-brand-600 text-white hover:bg-brand-700',
  ghost: 'bg-transparent text-navy-800 hover:bg-navy-900/5',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  outline:
    'border border-navy-900/12 bg-surface text-navy-900 hover:border-brand-500/50 hover:bg-teal-50',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
