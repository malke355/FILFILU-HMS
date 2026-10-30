import { IsIn, IsString } from 'class-validator';

export const APPOINTMENT_STATUSES = ['draft', 'requested', 'confirmed', 'cancelled', 'completed'] as const;

export class UpdateAppointmentDto {
  @IsString()
  @IsIn(APPOINTMENT_STATUSES)
  status!: (typeof APPOINTMENT_STATUSES)[number];
}
