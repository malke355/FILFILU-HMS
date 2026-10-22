import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FieldError, Input, Label, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { departmentService } from '@/services/departmentService'
import { staffService } from '@/services/staffService'
import { useStoreVersion } from '@/hooks/useStoreVersion'

const schema = z.object({
  employeeId: z.string().min(1, 'Required'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email(),
  role: z.enum(['admin', 'doctor', 'nurse']),
  departmentId: z.string().min(1),
  specialty: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function StaffPage() {
  const { version, refresh } = useStoreVersion()
  const [open, setOpen] = useState(false)
  void version
  const staff = staffService.list()
  const departments = departmentService.list()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'nurse', departmentId: departments[0]?.id },
  })

  const onSubmit = (values: FormValues) => {
    staffService.create({
      ...values,
      specialty: values.specialty || undefined,
      active: true,
      hireDate: new Date().toISOString().slice(0, 10),
    })
    reset()
    setOpen(false)
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Staff management"
        description="Create and deactivate demonstration staff records via typed services."
        actions={
          <Button onClick={() => setOpen(true)}>Add staff</Button>
        }
      />

      <div className="overflow-x-auto surface-panel">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-navy-900/8 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-navy-900/5 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-ink-500">
                    {s.employeeId} · {s.email}
                  </p>
                </td>
                <td className="px-4 py-3 capitalize">{s.role}</td>
                <td className="px-4 py-3">
                  {departments.find((d) => d.id === s.departmentId)?.name ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={s.active ? 'ok' : 'muted'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {s.active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        staffService.deactivate(s.id)
                        refresh()
                      }}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        staffService.update(s.id, { active: true })
                        refresh()
                      }}
                    >
                      Reactivate
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Add staff member" onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input {...register('firstName')} />
              <FieldError>{errors.firstName?.message}</FieldError>
            </div>
            <div>
              <Label>Last name</Label>
              <Input {...register('lastName')} />
              <FieldError>{errors.lastName?.message}</FieldError>
            </div>
          </div>
          <div>
            <Label>Employee ID</Label>
            <Input {...register('employeeId')} />
            <FieldError>{errors.employeeId?.message}</FieldError>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select {...register('role')}>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select {...register('departmentId')}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Specialty (optional)</Label>
            <Input {...register('specialty')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
