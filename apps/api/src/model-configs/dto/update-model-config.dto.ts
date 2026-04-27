import { ModelConfigStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateModelConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  apiKey?: string;

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsEnum(ModelConfigStatus)
  status?: ModelConfigStatus;
}

