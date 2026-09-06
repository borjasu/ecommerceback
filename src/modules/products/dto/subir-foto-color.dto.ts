import { IsHexColor, IsString, MaxLength, MinLength } from 'class-validator';

// Campos de texto del multipart/form-data de POST /productos/:id/colores — el
// archivo en sí llega aparte, vía @UploadedFile() (ver
// vendor-products.controller.ts), no como parte de este DTO.
export class SubirFotoColorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombreColor: string;

  // El hex del swatch que el vendedor ya tenía marcado en "Colores disponibles"
  // (ColorOpcion.hex en el frontend) — ya no sirve para generar nada, solo se
  // guarda para pintar el punto de color junto al nombre en la UI.
  @IsHexColor()
  colorHex: string;
}
