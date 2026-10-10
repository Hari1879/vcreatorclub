// Single source of truth for option lists. Keep in sync with
// web/src/app/core/constants.ts.

export const PLATFORMS = ['instagram', 'youtube', 'facebook', 'linkedin', 'threads'] as const;

export const CONTENT_CATEGORIES = [
  'Lifestyle',
  'Tech & Gadgets',
  'Travel',
  'Food',
  'Fashion',
  'Comedy',
  'Education',
  'Gaming',
  'Fitness',
  'Other',
] as const;

export const CONTENT_LANGUAGES = [
  'Tamil',
  'English',
  'Tanglish',
  'Hindi',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Other',
] as const;

export const CONTENT_TYPES = [
  'Short Videos',
  'Reels',
  'Long Form Video',
  'Photography',
  'Instagram Stories',
  'Live Streams',
  'Podcast',
  'Blog',
] as const;

export const TIERS = ['core_creator', 'campaign_creator', 'vcc_community', 'inactive'] as const;
export const CAMPAIGN_TIERS = ['core_creator', 'campaign_creator', 'vcc_community'] as const;
export const PROFILE_STATUSES = ['pending', 'approved', 'rejected', 'inactive'] as const;
export const CAMPAIGN_STATUSES = ['draft', 'open', 'closed', 'completed'] as const;
export const CAMPAIGN_TYPES = ['free', 'paid', 'gifted'] as const;
export const ASSIGNMENT_STATUSES = [
  'invited',
  'accepted',
  'declined',
  'submitted',
  'completed',
  'cancelled',
] as const;
export const NOTIFICATION_TYPES = ['info', 'campaign', 'approval', 'alert'] as const;
