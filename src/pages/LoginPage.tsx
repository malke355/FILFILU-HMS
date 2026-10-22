import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label, Select } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/Card'
import { useAuth } from '@/features/auth/AuthContext'
import type { UserRole } from '@/types'

const schema = z.object({
  role: z.enum(['admin', 'doctor', 'nurse', 'patient']),
  displayHint: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'admin' },
  })

  const onSubmit = (values: FormValues) => {
    loginAs(values.role as UserRole)
    const dest =
      values.role === 'admin'
        ? '/admin'
        : values.role === 'doctor'
          ? '/doctor'
          : values.role === 'nurse'
            ? '/nurse'
            : '/patient'
    navigate(dest)
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Demo login"
        description="This is not security. Choose a role to explore Filfilu Phase 1."
      />
      <Alert tone="warn" className="mb-4">
        No passwords, tokens, or hospital credentials are used. Role access is simulated in the
        browser for demonstration.
      </Alert>
      <form onSubmit={handleSubmit(onSubmit)} className="surface-panel space-y-4 p-5">
        <div>
          <Label htmlFor="role">Role</Label>
          <Select id="role" {...register('role')}>
            <option value="admin">Admin</option>
            <option value="doctor">Doctor</option>
            <option value="nurse">Nurse</option>
            <option value="patient">Patient</option>
          </Select>
          <FieldError>{errors.role?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="displayHint">Optional note (not verified)</Label>
          <Input id="displayHint" placeholder="e.g. exploring schedule UI" {...register('displayHint')} />
        </div>
        <Button type="submit" className="w-full">
          Continue with demo role
        </Button>
      </form>
    </div>
  )
}
