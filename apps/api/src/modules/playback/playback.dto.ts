import { IsUUID, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class CreatePlaybackDto {
  @IsUUID()
  titleId!: string;

  @IsUUID()
  @IsOptional()
  episodeId?: string;

  @IsUUID()
  @IsOptional()
  profileId?: string;

  @IsUUID()
  @IsOptional()
  deviceId?: string;
}

export class UpdateProgressDto {
  @IsUUID()
  titleId!: string;

  @IsUUID()
  @IsOptional()
  episodeId?: string;

  @IsUUID()
  @IsOptional()
  profileId?: string;

  @IsInt()
  @Min(0)
  positionSec!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  durationSec?: number;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
