import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

export enum DiagnosisItemAction {
  ADOPT = 'ADOPT',
  IGNORE = 'IGNORE',
  MANUAL_EDIT = 'MANUAL_EDIT',
}

export class ApplyDiagnosisItemActionDto {
  @IsEnum(DiagnosisItemAction)
  action!: DiagnosisItemAction;

  @IsOptional()
  @IsString()
  userNote?: string;

  @ValidateIf((dto: ApplyDiagnosisItemActionDto) => dto.action === DiagnosisItemAction.MANUAL_EDIT)
  @IsString()
  editedContent?: string;
}

