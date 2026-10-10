import { Platform, Tier } from './models';

// Keep in sync with api/src/common/constants.ts

export const DISCLAIMER =
  'Benefits are directional and subject to program terms. No commitments or assurances are made by FTPL or Vivo India.';

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'threads', label: 'Threads' },
];

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
];

export const CONTENT_LANGUAGES = ['Tamil', 'English', 'Tanglish', 'Hindi', 'Telugu', 'Malayalam', 'Kannada', 'Other'];

export const CONTENT_TYPES = [
  'Short Videos',
  'Reels',
  'Long Form Video',
  'Photography',
  'Instagram Stories',
  'Live Streams',
  'Podcast',
  'Blog',
];

export const TIER_META: Record<Tier, { label: string; pill: string; dot: string }> = {
  core_creator: {
    label: 'Core Creator',
    pill: 'bg-vcc-gold/15 text-vcc-gold border border-vcc-gold/50',
    dot: 'bg-vcc-gold',
  },
  campaign_creator: {
    label: 'Campaign Creator',
    pill: 'bg-vcc-blue/15 text-vcc-blue-light border border-vcc-blue/50',
    dot: 'bg-vcc-blue',
  },
  vcc_community: {
    label: 'VCC Community',
    pill: 'bg-vcc-teal/15 text-teal-300 border border-vcc-teal/60',
    dot: 'bg-vcc-teal',
  },
  inactive: {
    label: 'Inactive',
    pill: 'bg-vcc-gray/15 text-vcc-gray-light border border-vcc-gray/50',
    dot: 'bg-vcc-gray',
  },
};

/** Light-background tier pills for the admin tables. */
export const TIER_PILL_LIGHT: Record<Tier, string> = {
  core_creator: 'bg-amber-100 text-amber-800',
  campaign_creator: 'bg-blue-100 text-blue-800',
  vcc_community: 'bg-teal-100 text-teal-800',
  inactive: 'bg-slate-200 text-slate-700',
};

export const CAMPAIGN_TIER_OPTIONS: Tier[] = ['core_creator', 'campaign_creator', 'vcc_community'];
export const ALL_TIERS: Tier[] = ['core_creator', 'campaign_creator', 'vcc_community', 'inactive'];

export function formatCount(n: number | null | undefined): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function signInUrl(returnTo: string): string {
  return `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}
