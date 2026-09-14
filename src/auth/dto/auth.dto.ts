import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@citycare.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '+2347046059865', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: ['patient', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'laboratory', 'accountant', 'administrator'] })
  @IsString()
  @IsEnum(['patient', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'laboratory', 'accountant', 'administrator'])
  role: string;

  @ApiProperty({ example: 'Cardiology', required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ example: 'Cardiologist', required: false })
  @IsString()
  @IsOptional()
  specialization?: string;
}
