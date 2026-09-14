import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SymptomCheckerDto {
  @ApiProperty({ example: 'I have been experiencing headache, fever, and body aches for the past 2 days' })
  @IsString()
  symptoms: string;

  @ApiPropertyOptional({ example: '25' })
  @IsString()
  @IsOptional()
  age?: string;

  @ApiPropertyOptional({ example: 'Male' })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ example: ['diabetes', 'hypertension'] })
  @IsArray()
  @IsOptional()
  medicalHistory?: string[];
}

export class MedicalSummaryDto {
  @ApiProperty({ example: 'patient-id-123' })
  @IsString()
  patientId: string;
}

export class DrugInteractionDto {
  @ApiProperty({ example: ['Metformin', 'Lisinopril', 'Aspirin'] })
  @IsArray()
  medications: string[];
}

export class HealthTipsDto {
  @ApiPropertyOptional({ example: 'diabetes management' })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiPropertyOptional({ example: '35' })
  @IsString()
  @IsOptional()
  age?: string;

  @ApiPropertyOptional({ example: 'Male' })
  @IsString()
  @IsOptional()
  gender?: string;
}

export class AiChatDto {
  @ApiProperty({ example: 'What are the best exercises for heart health?' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: 'cardiology' })
  @IsString()
  @IsOptional()
  context?: string;
}
