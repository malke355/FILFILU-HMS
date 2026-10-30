import { IsEmail, IsString, MinLength } from 'class-validator';

export class ContactDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  topic!: string;

  @IsString()
  @MinLength(1)
  message!: string;
}
