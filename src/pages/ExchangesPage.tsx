import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldError, Label, Select, TextArea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/features/auth/AuthContext'
import { useStoreVersion } from '@/hooks/useStoreVersion'
import { exchangeService } from '@/services/exchangeService'
import { scheduleService } from '@/services/scheduleService'
import { staffService } from '@/services/staffService'
import { shiftTypeService } from '@/services/departmentService'

const schema = z.object({
  assignmentId: z.string().min(1),
  targetStaffId: z.string().min(1),
  reason: z.string().min(8, 'Please explain the request'),
})

type FormValues = z.infer<typeof schema>

const toneFor = {
  pending: 'warn',
  accepted: 'teal',
  approved: 'ok',
  rejected: 'danger',
  denied: 'danger',
  cancelled: 'muted',
} as const

export function ExchangesPage() {
  const { session } = useAuth()
  const { version, refresh } = useStoreVersion()
  void version
  const [open, setOpen] = useState(false)

  const exchanges = useMemo(() => {
    void version
    if (!session) return []
    if (session.role === 'admin') return exchangeService.list()
    return exchangeService.listForUser(session.userId)
  }, [session, version])

  const myAssignments = session
    ? scheduleService.listForStaff(session.userId).filter((a) => a.status === 'published')
    : []
  const peers = staffService
    .list()
    .filter((s) => s.active && s.id !== session?.userId && (s.role === 'doctor' || s.role === 'nurse'))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      assignmentId: myAssignments[0]?.id,
      targetStaffId: peers[0]?.id,
    },
  })

  if (!session || session.role === 'patient') {
    return (
      <EmptyState
        title="Staff exchanges only"
        description="Sign in with a doctor, nurse, or admin demo role to use the shift exchange workflow."
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Shift exchanges"
        description="Full demonstration approval path: request → peer accept/reject → admin approve/deny. Persisted in localStorage."
        actions={
          session.role !== 'admin' ? (
            <Button onClick={() => setOpen(true)}>Request exchange</Button>
          ) : null
        }
      />

      <Alert tone="info" className="mb-6">
        Demo workflow only. Approvals update in-browser mock data; they do not notify a real hospital.
      </Alert>

      {exchanges.length === 0 ? (
        <EmptyState title="No exchange requests" description="Create a request or wait for a peer." />
      ) : (
        <ul className="space-y-3">
          {exchanges.map((ex) => {
            const requester = staffService.getById(ex.requesterId)
            const target = staffService.getById(ex.targetStaffId)
            const assignment = scheduleService.getById(ex.assignmentId)
            const shift = assignment
              ? shiftTypeService.getById(assignment.shiftTypeId)
              : undefined
            const isTarget = session.userId === ex.targetStaffId
            const isRequester = session.userId === ex.requesterId
            return (
              <li key={ex.id} className="surface-panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy-900">
                      {requester?.firstName} {requester?.lastName} → {target?.firstName}{' '}
                      {target?.lastName}
                    </p>
                    <p className="mt-1 text-sm text-ink-500">
                      {assignment?.date} · {shift?.name} {shift?.startTime}–{shift?.endTime}
                      {shift?.overnight ? ' (+1 day)' : ''}
                    </p>
                    <p className="mt-2 text-sm">{ex.reason}</p>
                    {ex.adminNote ? (
                      <p className="mt-1 text-xs text-ink-500">Admin note: {ex.adminNote}</p>
                    ) : null}
                  </div>
                  <Badge tone={toneFor[ex.status]}>{ex.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isTarget && ex.status === 'pending' ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          exchangeService.respond(ex.id, true)
                          refresh()
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          exchangeService.respond(ex.id, false)
                          refresh()
                        }}
                      >
                        Decline
                      </Button>
                    </>
                  ) : null}
                  {session.role === 'admin' &&
                  (ex.status === 'accepted' || ex.status === 'pending') ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          exchangeService.adminDecide(ex.id, true)
                          refresh()
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          exchangeService.adminDecide(ex.id, false, 'Coverage not available')
                          refresh()
                        }}
                      >
                        Deny
                      </Button>
                    </>
                  ) : null}
                  {isRequester && ['pending', 'accepted'].includes(ex.status) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        exchangeService.cancel(ex.id)
                        refresh()
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={open} title="Request shift exchange" onClose={() => setOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) => {
            exchangeService.create({
              requesterId: session.userId,
              targetStaffId: values.targetStaffId,
              assignmentId: values.assignmentId,
              reason: values.reason,
            })
            setOpen(false)
            form.reset()
            refresh()
          })}
        >
          <div>
            <Label>Your published assignment</Label>
            <Select {...form.register('assignmentId')}>
              {myAssignments.map((a) => {
                const shift = shiftTypeService.getById(a.shiftTypeId)
                return (
                  <option key={a.id} value={a.id}>
                    {a.date} · {shift?.name}
                  </option>
                )
              })}
            </Select>
            <FieldError>{form.formState.errors.assignmentId?.message}</FieldError>
          </div>
          <div>
            <Label>Ask colleague</Label>
            <Select {...form.register('targetStaffId')}>
              {peers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.role})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Reason</Label>
            <TextArea rows={3} {...form.register('reason')} />
            <FieldError>{form.formState.errors.reason?.message}</FieldError>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit request</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
