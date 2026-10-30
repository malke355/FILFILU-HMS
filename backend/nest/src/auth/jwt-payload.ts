import type { Role } from './roles';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  name: string;
  staffId?: string | null;
  patientId?: string | null;
  ward?: string | null;
  dept?: string | null;
  title?: string | null;
};
