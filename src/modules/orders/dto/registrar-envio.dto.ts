import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

/** Captura manual de guía (courier local, sin pasar por Skydropx) — alterna a generar-guia. */
export class RegistrarEnvioDto {
  @IsString()
  @MinLength(2)
  paqueteria: string;

  @IsString()
  @MinLength(2)
  numeroGuia: string;

  @IsOptional()
  @IsUrl()
  urlRastreo?: string;
}
