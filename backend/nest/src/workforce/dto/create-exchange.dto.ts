import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExchangeDto {
  @IsString()
  @MinLength(1)
  toStaffId!: string;

  @IsString()
  @MinLength(1)
  date!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
