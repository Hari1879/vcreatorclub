export const SUPPORT_TYPES = ['paid', 'borrow', 'gifted', 'combined'] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number];

export const REQUEST_STATUSES = [
  'pending_review',
  'approved',
  'modified',
  'declined',
] as const;
export const DECISIONS = ['approved', 'modified', 'declined'] as const;

export const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Sent to V Team',
  approved: 'Approved',
  modified: 'Approved with changes',
  declined: 'Not taken forward',
};

export const SUBMIT_MESSAGE =
  'Your Co-Create request has been submitted successfully. Status: Sent to V Team. You will receive a response within 5-7 business days.';

export const FEE_COVERS = [
  'content_creation',
  'editing',
  'styling_props',
  'travel_logistics',
  'crew',
  'other',
] as const;
export const PAYMENT_MILESTONES = [
  'advance_50_50',
  'full_on_approval',
] as const;
export const BORROW_DURATIONS = ['d1_3', 'd4_7', 'd8_14', 'd15_plus'] as const;
export const BORROW_LOCATION_TYPES = ['own_premises', 'multiple'] as const;
export const CC_CONTENT_TYPES = [
  'ig_reel',
  'ig_post',
  'ig_stories',
  'yt_long',
  'yt_short',
  'other',
] as const;
export const PRODUCT_VISIBILITY = [
  'prominent',
  'partial',
  'mention_only',
] as const;
export const REVIEW_DAYS: Record<string, number> = {
  d1: 1,
  d2: 2,
  d3: 3,
  d5_plus: 5,
};
export const PRIMARY_PLATFORMS = ['instagram', 'youtube', 'both'] as const;
export const ACCOUNT_TYPES = ['savings', 'current'] as const;
export const FILE_KINDS = ['idea_doc', 'gst_proforma'] as const;

export const FLAG_VALUES = [
  'COMPETING_BRAND_DECLARED',
  'NO_TAG_COMMITMENT',
  'REVIEW_NOT_CONFIRMED',
  'MULTI_UNIT_REQUEST',
  'GST_REGISTERED',
] as const;

export const isPaidType = (t: string) => t === 'paid' || t === 'combined';
export const isGiftType = (t: string) => t === 'gifted' || t === 'combined';

// ---- Terms (versioned). The frontend renders exactly what the server verifies.
export const TERMS_VERSION = 'v1';

interface Clause {
  id: string;
  text: string;
  appliesTo: (t: SupportType) => boolean;
}

const TERMS_V1: Clause[] = [
  {
    id: '1',
    appliesTo: () => true,
    text: 'The idea I am submitting is my own original work, and I have the right to share it with FTPL and Vivo India for review.',
  },
  {
    id: '2',
    appliesTo: () => true,
    text: 'Submitting a request does not oblige FTPL or Vivo India to approve it. FTPL is not required to give reasons for its decision, and decisions are final for this request.',
  },
  {
    id: '3',
    appliesTo: () => true,
    text: 'I understand that a response is typically provided within 5-7 business days of submission.',
  },
  {
    id: '4',
    appliesTo: () => true,
    text: 'Any content I create will follow Vivo brand guidelines, platform rules, advertising disclosure requirements and applicable laws.',
  },
  {
    id: '5',
    appliesTo: () => true,
    text: 'The information in this request is accurate and complete, and I will tell the V Team promptly if anything changes.',
  },
  {
    id: '6',
    appliesTo: () => true,
    text: 'I have disclosed any active work with competing brands that could overlap with this request.',
  },
  {
    id: '7',
    appliesTo: () => true,
    text: 'I consent to FTPL processing the information and documents in this request for the purpose of reviewing it.',
  },
  {
    id: '8',
    appliesTo: (t) => t === 'borrow',
    text: 'Borrowed products remain the property of Vivo India / FTPL. I will return them in the same condition within the agreed duration and I am responsible for loss or damage while they are with me.',
  },
  {
    id: '9',
    appliesTo: isPaidType as (t: SupportType) => boolean,
    text: 'Any payment is subject to written approval and program terms. My bank details will be used only to process an approved payment, and I will provide valid tax documents where applicable.',
  },
];

export function clausesFor(type: SupportType) {
  return TERMS_V1.filter((c) => c.appliesTo(type)).map(({ id, text }) => ({
    id,
    text,
  }));
}
