import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateAppointmentDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  patientId?: string;

  @IsString()
  doctorId!: string;

  @IsString()
  date!: string;

  @IsString()
  time!: string;

  @IsString()
  dept!: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  reason?: string;
}
