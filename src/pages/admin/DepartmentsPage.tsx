import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FieldError, Input, Label } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { departmentService, shiftTypeService } from '@/services/departmentService'
import { useStoreVersion } from '@/hooks/useStoreVersion'

const deptSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(8),
  description: z.string().min(1),
})

const shiftSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(8),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  overnight: z.boolean(),
  color: z.string().min(1),
})

type DeptValues = z.infer<typeof deptSchema>
type ShiftValues = z.infer<typeof shiftSchema>

export function DepartmentsPage() {
  const { version, refresh } = useStoreVersion()
  void version
  const departments = departmentService.list()
  const shifts = shiftTypeService.list()
  const [deptOpen, setDeptOpen] = useState(false)
  const [shiftOpen, setShiftOpen] = useState(false)

  const deptForm = useForm<DeptValues>({
    resolver: zodResolver(deptSchema),
  })
  const shiftForm = useForm<ShiftValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { overnight: false, color: '#0D9488', startTime: '07:00', endTime: '15:00' },
  })

  return (
    <div>
      <PageHeader
        title="Departments & shifts"
        description="Configure demonstration departments and shift templates, including overnight night shifts."
        actions={
          <>
            <Button variant="outline" onClick={() => setDeptOpen(true)}>
              Add department
            </Button>
            <Button onClick={() => setShiftOpen(true)}>Add shift type</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl">Departments</h2>
          <ul className="space-y-3">
            {departments.map((d) => (
              <li key={d.id} className="surface-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {d.name} <span className="text-ink-500">({d.code})</span>
                    </p>
                    <p className="mt-1 text-sm text-ink-500">{d.description}</p>
                  </div>
                  <Badge tone={d.active ? 'ok' : 'muted'}>{d.active ? 'Active' : 'Off'}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl">Shift types</h2>
          <ul className="space-y-3">
            {shifts.map((s) => (
              <li key={s.id} className="surface-panel flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <div>
                    <p className="font-semibold">
                      {s.name} <span className="text-ink-500">({s.code})</span>
                    </p>
                    <p className="text-sm text-ink-500">
                      {s.startTime}–{s.endTime}
                      {s.overnight ? ' · overnight (+1 day)' : ''}
                    </p>
                  </div>
                </div>
                {s.overnight ? <Badge tone="navy">Overnight</Badge> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Modal open={deptOpen} title="Add department" onClose={() => setDeptOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={deptForm.handleSubmit((values) => {
            departmentService.create({ ...values, active: true })
            deptForm.reset()
            setDeptOpen(false)
            refresh()
          })}
        >
          <div>
            <Label>Name</Label>
            <Input {...deptForm.register('name')} />
            <FieldError>{deptForm.formState.errors.name?.message}</FieldError>
          </div>
          <div>
            <Label>Code</Label>
            <Input {...deptForm.register('code')} />
            <FieldError>{deptForm.formState.errors.code?.message}</FieldError>
          </div>
          <div>
            <Label>Description</Label>
            <Input {...deptForm.register('description')} />
            <FieldError>{deptForm.formState.errors.description?.message}</FieldError>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeptOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <Modal open={shiftOpen} title="Add shift type" onClose={() => setShiftOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={shiftForm.handleSubmit((values) => {
            shiftTypeService.create({ ...values, active: true })
            shiftForm.reset({
              overnight: false,
              color: '#0D9488',
              startTime: '07:00',
              endTime: '15:00',
            })
            setShiftOpen(false)
            refresh()
          })}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input {...shiftForm.register('name')} />
              <FieldError>{shiftForm.formState.errors.name?.message}</FieldError>
            </div>
            <div>
              <Label>Code</Label>
              <Input {...shiftForm.register('code')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="time" {...shiftForm.register('startTime')} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" {...shiftForm.register('endTime')} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="overnight" type="checkbox" {...shiftForm.register('overnight')} />
            <Label htmlFor="overnight" className="mb-0">
              Overnight (ends next calendar day)
            </Label>
          </div>
          <div>
            <Label>Color</Label>
            <Input type="color" {...shiftForm.register('color')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShiftOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
