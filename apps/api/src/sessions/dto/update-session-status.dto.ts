import { SessionStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSessionStatusDto {
  @IsEnum(SessionStatus)
  status!: SessionStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  overallScore?: number;
}

