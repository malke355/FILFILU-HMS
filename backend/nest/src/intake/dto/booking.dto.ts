import { IsString, MinLength } from 'class-validator';

export class BookingDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  department!: string;

  @IsString()
  @MinLength(1)
  date!: string;
}
