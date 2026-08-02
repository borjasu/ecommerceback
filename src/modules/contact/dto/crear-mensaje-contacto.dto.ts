import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearMensajeContactoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  // Tope duro: es un endpoint público sin autenticación, el más expuesto a
  // abuso de todo el backend (ver también el rate limiting en el controller)
  // — sin límite de longitud, alguien podría mandar mensajes de varios MB.
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  mensaje: string;
}
