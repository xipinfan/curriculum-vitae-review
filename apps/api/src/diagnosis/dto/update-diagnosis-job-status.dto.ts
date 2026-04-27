import { DiagnosisJobStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateDiagnosisJobStatusDto {
  @IsEnum(DiagnosisJobStatus)
  status!: DiagnosisJobStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

