import { cn } from '@/lib/cn'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

const fieldBase =
  'w-full rounded-xl border border-navy-900/12 bg-surface px-3.5 py-2.5 text-sm text-navy-900 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, 'placeholder:text-ink-500/70', className)} {...props} />
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(fieldBase, 'placeholder:text-ink-500/70', className)} {...props} />
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, className)} {...props}>
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
    <label
      htmlFor={htmlFor}
      className={cn('mb-1.5 block text-sm font-semibold text-navy-800', className)}
    >
      {children}
    </label>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-1 text-xs text-danger-600">{children}</p>
}
