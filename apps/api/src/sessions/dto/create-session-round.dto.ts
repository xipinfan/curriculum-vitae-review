import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSessionRoundDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  referenceAnswer?: string;

  @IsOptional()
  @IsString()
  userAnswer?: string;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  followUpQuestion?: string;
}

