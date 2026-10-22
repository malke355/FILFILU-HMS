export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-navy-900/15 bg-white/50 px-6 py-12 text-center">
      <p className="font-display text-xl text-navy-900">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
