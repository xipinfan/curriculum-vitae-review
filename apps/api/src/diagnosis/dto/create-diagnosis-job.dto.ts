import { IsOptional, IsString } from 'class-validator';

export class CreateDiagnosisJobDto {
  @IsString()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  resumeDocumentId?: string;

  @IsOptional()
  @IsString()
  targetRole?: string;

  @IsOptional()
  @IsString()
  targetLevel?: string;

  @IsOptional()
  @IsString()
  techStack?: string;

  @IsOptional()
  @IsString()
  businessDomain?: string;
}

