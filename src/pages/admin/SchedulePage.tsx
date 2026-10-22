import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format, startOfMonth, startOfWeek } from 'date-fns'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/Card'
import { FieldError, Input, Label, Select, TextArea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { monthDays, toISODate, weekDays } from '@/lib/dates'
import { departmentService, shiftTypeService } from '@/services/departmentService'
import { scheduleService } from '@/services/scheduleService'
import { staffService } from '@/services/staffService'
import { useStoreVersion } from '@/hooks/useStoreVersion'
import type { ConflictWarning, DutyVisibility, ScheduleStatus } from '@/types'

const schema = z.object({
  staffId: z.string().min(1),
  departmentId: z.string().min(1),
  shiftTypeId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(['draft', 'published']),
  visibility: z.enum(['public', 'staff', 'private']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>
type ViewMode = 'day' | 'week' | 'month'

export function SchedulePage() {
  const { version, refresh } = useStoreVersion()
  void version
  const [anchor, setAnchor] = useState(new Date())
  const [view, setView] = useState<ViewMode>('week')
  const [open, setOpen] = useState(false)
  const [warnings, setWarnings] = useState<ConflictWarning[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduleStatus>('all')

  const staff = staffService.list().filter((s) => s.active && s.role !== 'admin')
  const departments = departmentService.list()
  const shifts = shiftTypeService.list()
  const assignments = scheduleService.list()

  const days = useMemo(() => {
    if (view === 'day') return [anchor]
    if (view === 'week') return weekDays(anchor)
    return monthDays(anchor)
  }, [anchor, view])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: toISODate(new Date()),
      status: 'draft',
      visibility: 'private',
      staffId: staff[0]?.id,
      departmentId: staff[0]?.departmentId ?? departments[0]?.id,
      shiftTypeId: shifts[0]?.id,
    },
  })

  const filteredForDay = (date: string) =>
    assignments.filter((a) => {
      if (a.date !== date) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      return true
    })

  const selectedIds = assignments.filter((a) => a.status === 'draft').map((a) => a.id)

  return (
    <div>
      <PageHeader
        title="Duty schedule"
        description="Day, week, and month views with draft/publish, overnight shifts, and conflict warnings."
        actions={
          <>
            <Button
              variant="outline"
              disabled={selectedIds.length === 0}
              onClick={() => {
                scheduleService.publishMany(selectedIds)
                refresh()
              }}
            >
              Publish all drafts
            </Button>
            <Button onClick={() => setOpen(true)}>Assign shift</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={view === mode ? 'primary' : 'outline'}
            className="capitalize"
            onClick={() => setView(mode)}
          >
            {mode}
          </Button>
        ))}
        <Select
          className="w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          aria-label="Status filter"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setAnchor((d) =>
                view === 'month' ? addDays(startOfMonth(d), -1) : addDays(d, view === 'day' ? -1 : -7),
              )
            }
          >
            Prev
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setAnchor((d) =>
                view === 'month' ? addDays(startOfMonth(d), 32) : addDays(d, view === 'day' ? 1 : 7),
              )
            }
          >
            Next
          </Button>
        </div>
      </div>

      <p className="mb-3 text-sm text-ink-500">
        Showing {view} starting{' '}
        <strong className="text-navy-900">
          {format(view === 'week' ? startOfWeek(anchor, { weekStartsOn: 1 }) : anchor, 'MMM d, yyyy')}
        </strong>
      </p>

      <div
        className={
          view === 'month'
            ? 'grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7'
            : 'grid gap-3'
        }
      >
        {days.map((day) => {
          const iso = toISODate(day)
          const items = filteredForDay(iso)
          return (
            <section key={iso} className="surface-panel min-h-28 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy-900">{format(day, view === 'month' ? 'd' : 'EEE MMM d')}</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    form.setValue('date', iso)
                    setOpen(true)
                  }}
                >
                  +
                </Button>
              </div>
              <ul className="space-y-2">
                {items.map((a) => {
                  const member = staffService.getById(a.staffId)
                  const shift = shifts.find((s) => s.id === a.shiftTypeId)
                  return (
                    <li
                      key={a.id}
                      className="rounded-xl border border-navy-900/8 bg-surface p-2 text-xs"
                      style={{ borderLeftWidth: 3, borderLeftColor: shift?.color ?? '#0D9488' }}
                    >
                      <p className="font-semibold">
                        {member ? `${member.firstName} ${member.lastName}` : a.staffId}
                      </p>
                      <p className="text-ink-500">
                        {shift?.name} {shift?.startTime}–{shift?.endTime}
                        {shift?.overnight ? ' +1' : ''}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone={a.status === 'published' ? 'ok' : 'warn'}>{a.status}</Badge>
                        <Badge tone="muted">{a.visibility}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {a.status === 'draft' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              scheduleService.setStatus(a.id, 'published')
                              refresh()
                            }}
                          >
                            Publish
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              scheduleService.setStatus(a.id, 'draft')
                              refresh()
                            }}
                          >
                            Unpublish
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            scheduleService.remove(a.id)
                            refresh()
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <Modal open={open} title="Assign duty shift" onClose={() => { setOpen(false); setWarnings([]) }}>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) => {
            const selectedStaff = staffService.getById(values.staffId)
            const visibility: DutyVisibility =
              values.visibility ??
              (selectedStaff?.role === 'nurse' ? 'private' : 'public')
            const { warnings: detected } = scheduleService.create({
              staffId: values.staffId,
              departmentId: values.departmentId,
              shiftTypeId: values.shiftTypeId,
              date: values.date,
              status: values.status,
              visibility:
                selectedStaff?.role === 'nurse' && visibility === 'public'
                  ? 'private'
                  : visibility,
              notes: values.notes,
            })
            setWarnings(detected)
            if (detected.length === 0) {
              setOpen(false)
              form.reset({
                ...form.getValues(),
                notes: '',
                status: 'draft',
              })
            }
            refresh()
          })}
        >
          {warnings.length > 0 ? (
            <Alert tone="warn" title="Conflict warnings">
              <ul className="list-disc pl-4">
                {warnings.map((w, i) => (
                  <li key={`${w.type}-${i}`}>{w.message}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Assignment was still saved so you can review overlaps.</p>
            </Alert>
          ) : null}
          <div>
            <Label>Staff</Label>
            <Select
              {...form.register('staffId', {
                onChange: (e) => {
                  const member = staffService.getById(e.target.value)
                  if (member) {
                    form.setValue('departmentId', member.departmentId)
                    form.setValue(
                      'visibility',
                      member.role === 'nurse' ? 'private' : 'public',
                    )
                  }
                },
              })}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.role})
                </option>
              ))}
            </Select>
            <FieldError>{form.formState.errors.staffId?.message}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Select {...form.register('departmentId')}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Shift</Label>
              <Select {...form.register('shiftTypeId')}>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.overnight ? ' (overnight)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" {...form.register('date')} />
            </div>
            <div>
              <Label>Status</Label>
              <Select {...form.register('status')}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Visibility</Label>
            <Select {...form.register('visibility')}>
              <option value="private">Private (default for nurses)</option>
              <option value="staff">Staff only</option>
              <option value="public">Public directory</option>
            </Select>
            <p className="mt-1 text-xs text-ink-500">
              Nurse assignments force private when public is selected in this demo.
            </p>
          </div>
          <div>
            <Label>Notes</Label>
            <TextArea rows={2} {...form.register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save assignment</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
