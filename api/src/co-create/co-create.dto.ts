import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DECISIONS,
  FLAG_VALUES,
  REQUEST_STATUSES,
  SUPPORT_TYPES,
} from './constants';

const trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class TermsQuery {
  @IsIn(SUPPORT_TYPES as unknown as string[])
  supportType!: (typeof SUPPORT_TYPES)[number];
}

export class ListCoCreateQuery {
  @IsOptional() @IsIn(REQUEST_STATUSES as unknown as string[]) status?: string;
  @IsOptional()
  @IsIn(SUPPORT_TYPES as unknown as string[])
  supportType?: string;
  @IsOptional() @IsIn(FLAG_VALUES as unknown as string[]) flag?: string;
  @IsOptional() @trim() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Matches(DATE_RE) from?: string;
  @IsOptional() @Matches(DATE_RE) to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class DecisionDto {
  @IsIn(DECISIONS as unknown as string[]) decision!: (typeof DECISIONS)[number];
  @IsOptional() @trim() @IsString() @MaxLength(1000) note?: string;
}

export class MarkReadDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids?: string[];
}
