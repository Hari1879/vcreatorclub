import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CONTENT_CATEGORIES,
  CONTENT_LANGUAGES,
  CONTENT_TYPES,
  PLATFORMS,
} from './constants';

const trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const emptyToNull = () =>
  Transform(({ value }) =>
    value === '' || value === undefined ? null : typeof value === 'string' ? value.trim() : value,
  );
const toInt = () =>
  Transform(({ value }) => (value === '' || value === null || value === undefined ? 0 : Number(value)));
const toMoney = () =>
  Transform(({ value }) => (value === '' || value === null || value === undefined ? null : Number(value)));

/** Creator profile fields — shared by enrollment submit and profile edit. */
export class ProfileDto {
  // ---- Step 1: personal ----
  @trim() @IsString() @Length(2, 100)
  fullName!: string;

  @trim() @IsEmail() @MaxLength(200)
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '') : value))
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone!: string;

  @trim() @IsString() @Length(2, 80)
  city!: string;

  @IsIn(['direct', 'manager'])
  coordinationMode!: 'direct' | 'manager';

  @ValidateIf((o) => o.coordinationMode === 'manager')
  @trim() @IsString() @Length(2, 100)
  managerName?: string | null;

  @ValidateIf((o) => o.coordinationMode === 'manager')
  @trim() @IsString() @Length(5, 120)
  managerContact?: string | null;

  // ---- Step 2: platforms ----
  @IsIn(PLATFORMS as unknown as string[])
  corePlatform!: (typeof PLATFORMS)[number];

  @IsOptional() @emptyToNull() @IsString() @MaxLength(60)
  instagramHandle?: string | null;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(300)
  instagramUrl?: string | null;
  @toInt() @IsInt() @Min(0) @Max(1_000_000_000)
  instagramFollowers = 0;

  @IsOptional() @emptyToNull() @IsString() @MaxLength(100)
  youtubeHandle?: string | null;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(300)
  youtubeUrl?: string | null;
  @toInt() @IsInt() @Min(0) @Max(1_000_000_000)
  youtubeSubscribers = 0;

  @IsOptional() @emptyToNull() @IsString() @MaxLength(300)
  facebookUrl?: string | null;
  @toInt() @IsInt() @Min(0) @Max(1_000_000_000)
  facebookFollowers = 0;

  @IsOptional() @emptyToNull() @IsString() @MaxLength(300)
  linkedinUrl?: string | null;
  @toInt() @IsInt() @Min(0) @Max(1_000_000_000)
  linkedinFollowers = 0;

  @IsOptional() @emptyToNull() @IsString() @MaxLength(60)
  threadsHandle?: string | null;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(300)
  threadsUrl?: string | null;
  @toInt() @IsInt() @Min(0) @Max(1_000_000_000)
  threadsFollowers = 0;

  @IsOptional() @emptyToNull() @IsString() @MaxLength(200)
  otherPlatforms?: string | null;

  @IsIn(CONTENT_CATEGORIES as unknown as string[])
  contentCategory!: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8)
  @IsIn(CONTENT_LANGUAGES as unknown as string[], { each: true })
  contentLanguages!: string[];

  // ---- Step 3: content profile ----
  @IsArray() @ArrayMaxSize(8)
  @IsIn(CONTENT_TYPES as unknown as string[], { each: true })
  contentTypes: string[] = [];

  @IsOptional() @emptyToNull() @IsString() @MaxLength(300)
  bio?: string | null;

  @IsOptional() @toMoney() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000)
  rateStory?: number | null;
  @IsOptional() @toMoney() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000)
  ratePost?: number | null;
  @IsOptional() @toMoney() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000)
  rateReel?: number | null;
  @IsOptional() @toMoney() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000)
  rateTvc?: number | null;

  @IsBoolean()
  workedWithVivo = false;

  @IsOptional() @emptyToNull() @IsString() @MaxLength(300)
  vivoWorkDetails?: string | null;
}

/** Enrollment submit = profile + token + consent checkboxes. */
export class SubmitEnrollmentDto extends ProfileDto {
  @IsString() @Matches(/^vcc-[a-f0-9]{32}$/)
  token!: string;

  @IsOptional() @IsString() @MaxLength(64)
  draftId?: string;

  @Equals(true, { message: 'Please agree to enrol in the V Creater Club program' })
  consentEnroll!: boolean;

  @Equals(true, { message: 'Please accept the confidentiality terms' })
  consentConfidentiality!: boolean;
}

const CORE_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  threads: 'Threads',
};

/**
 * Cross-field rule: the chosen core platform must have a handle/URL and
 * a follower count. Returns an error message or null.
 */
export function corePlatformError(d: ProfileDto): string | null {
  const name = CORE_LABEL[d.corePlatform];
  const checks: Record<string, [unknown, number]> = {
    instagram: [d.instagramHandle || d.instagramUrl, d.instagramFollowers],
    youtube: [d.youtubeHandle || d.youtubeUrl, d.youtubeSubscribers],
    facebook: [d.facebookUrl, d.facebookFollowers],
    linkedin: [d.linkedinUrl, d.linkedinFollowers],
    threads: [d.threadsHandle || d.threadsUrl, d.threadsFollowers],
  };
  const [link, followers] = checks[d.corePlatform];
  if (!link) return `Please add your ${name} handle or profile link (your core platform).`;
  if (!followers || followers < 1) return `Please add your ${name} follower count.`;
  return null;
}

/** Normalise handles and map DTO → database columns. */
export function profileColumns(d: ProfileDto): Record<string, unknown> {
  const at = (h?: string | null) => (h ? (h.startsWith('@') ? h : `@${h}`) : null);
  const manager = d.coordinationMode === 'manager';
  return {
    full_name: d.fullName,
    email: d.email.toLowerCase(),
    phone: d.phone,
    city: d.city,
    coordination_mode: d.coordinationMode,
    manager_name: manager ? d.managerName : null,
    manager_contact: manager ? d.managerContact : null,
    core_platform: d.corePlatform,
    instagram_handle: at(d.instagramHandle),
    instagram_url: d.instagramUrl ?? null,
    instagram_followers: d.instagramFollowers ?? 0,
    youtube_handle: at(d.youtubeHandle),
    youtube_url: d.youtubeUrl ?? null,
    youtube_subscribers: d.youtubeHandle || d.youtubeUrl ? (d.youtubeSubscribers ?? 0) : 0,
    facebook_url: d.facebookUrl ?? null,
    facebook_followers: d.facebookFollowers ?? 0,
    linkedin_url: d.linkedinUrl ?? null,
    linkedin_followers: d.linkedinFollowers ?? 0,
    threads_handle: at(d.threadsHandle),
    threads_url: d.threadsUrl ?? null,
    threads_followers: d.threadsFollowers ?? 0,
    other_platforms: d.otherPlatforms ?? null,
    content_category: d.contentCategory,
    content_languages: d.contentLanguages,
    content_types: d.contentTypes ?? [],
    bio: d.bio ?? null,
    rate_story_inr: d.rateStory ?? null,
    rate_post_inr: d.ratePost ?? null,
    rate_reel_inr: d.rateReel ?? null,
    rate_tvc_inr: d.rateTvc ?? null,
    worked_with_vivo: !!d.workedWithVivo,
    vivo_work_details: d.workedWithVivo ? (d.vivoWorkDetails ?? null) : null,
  };
}

/** Build a parameterised INSERT/UPDATE fragment from a column map. */
export function sqlSet(cols: Record<string, unknown>, startIndex = 1) {
  const keys = Object.keys(cols);
  return {
    keys,
    values: keys.map((k) => cols[k]),
    setClause: keys.map((k, i) => `${k} = $${i + startIndex}`).join(', '),
    placeholders: keys.map((_, i) => `$${i + startIndex}`).join(', '),
  };
}
