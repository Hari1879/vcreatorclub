import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ASSIGNABLE_ROLES = [
  'super_admin',
  'admin',
  'viewer',
  'none',
] as const;

export class ListUsersQuery {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class SetRoleDto {
  @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role!: (typeof ASSIGNABLE_ROLES)[number];
}
