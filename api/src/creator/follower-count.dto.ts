import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength } from 'class-validator';

export const FOLLOWER_PLATFORMS = ['youtube'] as const;
export type FollowerPlatform = (typeof FOLLOWER_PLATFORMS)[number];

export class FollowerCountQueryDto {
  @IsIn(FOLLOWER_PLATFORMS, {
    message: 'Unsupported platform, only youtube is supported',
  })
  platform!: FollowerPlatform;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  url!: string;
}

export interface FollowerCountResult {
  count: number | null;
  hidden: boolean;
}
