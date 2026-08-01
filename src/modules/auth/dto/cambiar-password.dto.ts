import { IsString, Matches } from 'class-validator';

const REGEX_PASSWORD = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export class CambiarPasswordDto {
  @IsString()
  passwordActual: string;

  @IsString()
  @Matches(REGEX_PASSWORD, {
    message:
      'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un número.',
  })
  passwordNueva: string;
}
