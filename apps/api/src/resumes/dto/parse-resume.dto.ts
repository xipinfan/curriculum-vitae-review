import { IsBoolean, IsOptional } from 'class-validator';

export class ParseResumeDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

