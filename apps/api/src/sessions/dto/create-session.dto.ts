import { SessionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  diagnosisJobId?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}

