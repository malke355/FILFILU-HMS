import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ROLES, type Role } from '../roles';

export class SignupDto {
  @IsString()
  @MinLength(1)
  first!: string;

  @IsString()
  @MinLength(1)
  last!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsIn(ROLES as unknown as string[])
  role!: Role;
}
