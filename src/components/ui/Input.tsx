import { cn } from '@/lib/cn'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-navy-900/12 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-ink-500/70 focus:border-teal-600',
        className,
      )}
      {...props}
    />
  )
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-navy-900/12 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-ink-500/70 focus:border-teal-600',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-xl border border-navy-900/12 bg-white px-3 py-2 text-sm text-navy-900 focus:border-teal-600',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({
  className,
  children,
  htmlFor,
}: {
  className?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1 block text-sm font-medium text-navy-800', className)}>
      {children}
    </label>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-1 text-xs text-danger-600">{children}</p>
}
