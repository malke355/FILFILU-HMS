import { PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { downloadCsv } from '@/lib/csv'
import { reportService } from '@/services/reportService'
import { resetStore } from '@/services/storage'
import { useStoreVersion } from '@/hooks/useStoreVersion'

export function ReportsPage() {
  const { refresh } = useStoreVersion()

  return (
    <div>
      <PageHeader
        title="Reports & export"
        description="Download CSV snapshots of demonstration schedule, staff, and exchange data."
      />
      <Alert tone="info" className="mb-6">
        Exports reflect in-browser mock data only. Reset restores the Phase 1 seed dataset.
      </Alert>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-panel p-5">
          <h2 className="font-display text-lg">Duty assignments</h2>
          <p className="mt-1 text-sm text-ink-500">All draft and published rows.</p>
          <Button
            className="mt-4"
            onClick={() =>
              downloadCsv('filfilu-duty-assignments.csv', reportService.dutyAssignmentsCsv())
            }
          >
            Export CSV
          </Button>
        </div>
        <div className="surface-panel p-5">
          <h2 className="font-display text-lg">Staff roster</h2>
          <p className="mt-1 text-sm text-ink-500">Active and inactive staff.</p>
          <Button
            className="mt-4"
            onClick={() => downloadCsv('filfilu-staff.csv', reportService.staffRosterCsv())}
          >
            Export CSV
          </Button>
        </div>
        <div className="surface-panel p-5">
          <h2 className="font-display text-lg">Exchanges</h2>
          <p className="mt-1 text-sm text-ink-500">Full exchange request history.</p>
          <Button
            className="mt-4"
            onClick={() => downloadCsv('filfilu-exchanges.csv', reportService.exchangesCsv())}
          >
            Export CSV
          </Button>
        </div>
      </div>
      <div className="mt-8">
        <Button
          variant="outline"
          onClick={() => {
            resetStore()
            refresh()
          }}
        >
          Reset demo data
        </Button>
      </div>
    </div>
  )
}
