import { Alert } from '@/components/ui/Alert'

export function ScheduleDisclaimer({ className }: { className?: string }) {
  return (
    <Alert tone="warn" title="Schedule information disclaimer" className={className}>
      Duty listings are for demonstration only. They are not a substitute for contacting the
      hospital through official channels, do not confirm clinician availability for care, and may
      not reflect real-time staffing. Draft schedules are never shown publicly.
    </Alert>
  )
}
