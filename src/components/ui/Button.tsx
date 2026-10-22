import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'

const variants: Record<Variant, string> = {
  primary:
    'bg-navy-900 text-white hover:bg-navy-800 shadow-sm shadow-navy-900/20',
  secondary: 'bg-teal-600 text-white hover:bg-teal-500',
  ghost: 'bg-transparent text-navy-800 hover:bg-navy-900/5',
  danger: 'bg-danger-600 text-white hover:bg-red-700',
  outline:
    'border border-navy-900/15 bg-white/70 text-navy-900 hover:border-teal-600/40 hover:bg-teal-50',
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-5 py-2.5 text-base',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
