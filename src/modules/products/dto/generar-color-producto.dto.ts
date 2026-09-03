import { IsHexColor, IsString, MaxLength, MinLength } from 'class-validator';

export class GenerarColorProductoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombreColor: string;

  @IsHexColor()
  colorHex: string;
}
