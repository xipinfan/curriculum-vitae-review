import { IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { ModelConfigStatus } from '@prisma/client';

export class CreateModelConfigDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsString()
  @MinLength(8)
  apiKey!: string;

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsEnum(ModelConfigStatus)
  status?: ModelConfigStatus;
}

