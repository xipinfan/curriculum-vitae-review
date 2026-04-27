import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitSessionAnswerDto {
  @IsString()
  @MinLength(8)
  userAnswer!: string;

  @IsOptional()
  @IsBoolean()
  createFollowUp?: boolean;
}

