import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class TestModelConnectionDto {
  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsString()
  @MinLength(8)
  apiKey!: string;

  @IsOptional()
  @IsString()
  model?: string;
}

