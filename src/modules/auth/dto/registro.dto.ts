import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const REGEX_PASSWORD = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export class RegistroDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Matches(REGEX_PASSWORD, {
    message:
      'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.',
  })
  password: string;

  // Declarado a propósito y aceptado por el ValidationPipe (whitelist), pero
  // AuthService.registro() NUNCA lee este campo: el rol siempre se fuerza a
  // 'comprador' en el servicio. Si no declaráramos esta propiedad, forbidNonWhitelisted
  // rechazaría con 400 cualquier intento malicioso de mandar rol en el body — preferimos
  // que la petición funcione igual, pero ignorando por completo lo que venga aquí.
  @IsOptional()
  @IsString()
  rol?: string;
}
