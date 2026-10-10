import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ASSIGNMENT_STATUSES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TIERS,
  CAMPAIGN_TYPES,
  NOTIFICATION_TYPES,
  PROFILE_STATUSES,
  TIERS,
} from '../common/constants';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const nullable = () => Transform(({ value }) => (value === '' ? null : value));

export class ListCreatorsQuery {
  @IsOptional() @trim() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(PROFILE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(TIERS as unknown as string[]) tier?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 10;
}

export class ApproveDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('all', { each: true })
  ids!: string[];
}

export class RejectDto {
  @IsOptional() @trim() @IsString() @MaxLength(500) note?: string;
}

export class UpdateCreatorDto {
  @IsOptional() @IsIn(TIERS as unknown as string[]) tier?: string;
  @IsOptional() @IsIn(PROFILE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @nullable() @IsString() @MaxLength(2000) adminNotes?: string | null;
}

export class CampaignDto {
  @trim() @IsString() @Length(2, 150) title!: string;
  @trim() @IsString() @Length(1, 150) product!: string;
  @IsOptional() @nullable() @IsString() @MaxLength(5000) description?: string | null;
  @IsIn(CAMPAIGN_TYPES as unknown as string[]) campaignType!: string;
  @IsOptional() @nullable() @IsNumber() @Min(0) @Max(1_000_000_000) budgetInr?: number | null;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true })
  deliverables: string[] = [];
  @IsOptional() @nullable() @IsDateString() deadline?: string | null;
  @IsArray() @ArrayMinSize(1) @IsIn(CAMPAIGN_TIERS as unknown as string[], { each: true })
  eligibleTiers!: string[];
  @IsOptional() @nullable() @IsInt() @Min(1) @Max(10_000) maxCreators?: number | null;
  @IsOptional() @IsIn(['draft', 'open']) status?: 'draft' | 'open';
}

export class CampaignStatusDto {
  @IsIn(CAMPAIGN_STATUSES as unknown as string[]) status!: string;
}

export class AssignmentUpdateDto {
  @IsOptional() @IsIn(ASSIGNMENT_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @nullable() @IsString() @MaxLength(2000) adminNotes?: string | null;
}

export class CreateTokenDto {
  @trim() @IsString() @Length(2, 120) label!: string;
  @IsBoolean() isEventToken!: boolean;
  @IsInt() @Min(1) @Max(10_000) maxUses!: number;
  @IsDateString() expiresAt!: string;
}

export class UpdateTokenDto {
  @IsBoolean() isActive!: boolean;
}

export class SendNotificationDto {
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsUUID('all', { each: true }) creatorIds?: string[];
  @IsOptional() @IsBoolean() allApproved?: boolean;
  @trim() @IsString() @Length(2, 120) title!: string;
  @trim() @IsString() @Length(2, 1000) message!: string;
  @IsIn(NOTIFICATION_TYPES as unknown as string[]) type!: string;
}
