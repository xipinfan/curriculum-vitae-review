import { DiagnosisItemStatus, DiagnosisSeverity } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateDiagnosisItemDto {
  @IsString()
  category!: string;

  @IsEnum(DiagnosisSeverity)
  severity!: DiagnosisSeverity;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  suggestion?: string;

  @IsOptional()
  @IsEnum(DiagnosisItemStatus)
  status?: DiagnosisItemStatus;

  @IsOptional()
  @IsString()
  userNote?: string;
}

