import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class ReportesQueryDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsIn(['dia', 'semana', 'mes'])
  granularidad?: 'dia' | 'semana' | 'mes';
}
