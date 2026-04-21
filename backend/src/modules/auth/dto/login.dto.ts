import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}