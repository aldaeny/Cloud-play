import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsBoolean()
  @IsOptional()
  isKid?: boolean;

  @IsString()
  @IsOptional()
  maturityMax?: string;

  @IsString()
  @IsOptional()
  @MinLength(4)
  pin?: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isKid?: boolean;

  @IsString()
  @IsOptional()
  maturityMax?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  @MinLength(4)
  pin?: string;
}

export class VerifyPinDto {
  @IsString()
  @MinLength(4)
  pin!: string;
}
