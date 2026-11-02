import { IsEmail, IsString, MinLength, IsPhoneNumber, IsEnum, IsUUID, IsOptional } from 'class-validator';

export enum IdentityProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  APPLE = 'apple',
  FACEBOOK = 'facebook',
  PHONE = 'phone',
  AETHER = 'aether',
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsPhoneNumber()
  phone!: string;

  @IsString()
  @IsOptional()
  profileId?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class LoginPhoneDto {
  @IsString()
  @IsPhoneNumber()
  phone!: string;

  @IsString()
  password!: string;
}

export class IdentityLinkDto {
  @IsUUID()
  profileId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsEnum(IdentityProvider)
  provider!: IdentityProvider;

  @IsString()
  @IsOptional()
  providerAccountId?: string;
}

export class IdentityUpdateDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  name?: string;
}
