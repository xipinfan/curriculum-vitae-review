import { ResumeSourceType } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class ImportResumeDto {
  @IsString()
  workspaceId!: string;

  @IsEnum(ResumeSourceType)
  sourceType!: ResumeSourceType;

  @IsString()
  @MinLength(10)
  content!: string;
}

