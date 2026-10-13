import { Paged } from './models';

export type SupportType = 'paid' | 'borrow' | 'gifted' | 'combined';
export type CoCreateStatus = 'sent_to_v_team' | 'approved' | 'approved_with_changes' | 'declined';
export type CoCreateFlag =
  | 'COMPETING_BRAND_DECLARED'
  | 'NO_TAG_COMMITMENT'
  | 'REVIEW_NOT_CONFIRMED'
  | 'MULTI_UNIT_REQUEST'
  | 'GST_REGISTERED';
export type CoCreateDecision = 'approve' | 'approve_with_changes' | 'decline';
export type UploadKind = 'idea_doc' | 'gst_proforma';

export const STATUS_LABEL: Record<CoCreateStatus, string> = {
  sent_to_v_team: 'Sent to V Team',
  approved: 'Approved',
  approved_with_changes: 'Approved with changes',
  declined: 'Declined',
};

export const STATUS_CLS: Record<CoCreateStatus, string> = {
  sent_to_v_team: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  approved_with_changes: 'bg-blue-100 text-blue-800',
  declined: 'bg-red-100 text-red-800',
};

export const FLAG_META: Record<CoCreateFlag, { short: string; title: string; text: string; severity: 'red' | 'amber' }> = {
  COMPETING_BRAND_DECLARED: {
    short: 'Competing brand',
    title: 'Competing brand declared',
    text: 'Review disclosed brand(s) before approving. Assess exclusivity risk.',
    severity: 'red',
  },
  NO_TAG_COMMITMENT: {
    short: 'No tag',
    title: 'No tag commitment',
    text: 'Creator does not plan to tag Vivo/VCC. Confirm acceptability before proceeding.',
    severity: 'red',
  },
  REVIEW_NOT_CONFIRMED: {
    short: 'Review not confirmed',
    title: 'Review not confirmed',
    text: 'Creator flagged hesitation on pre-publish review. Confirm verbally before contract.',
    severity: 'amber',
  },
  MULTI_UNIT_REQUEST: {
    short: 'Multi-unit',
    title: 'Multi-unit request',
    text: 'More than 1 device requested. Evaluate justification before approval.',
    severity: 'amber',
  },
  GST_REGISTERED: {
    short: 'GST',
    title: 'GST registered',
    text: 'Proforma invoice uploaded. Verify GST number and invoice details before payment.',
    severity: 'amber',
  },
};
export const ALL_FLAGS = Object.keys(FLAG_META) as CoCreateFlag[];

export interface UploadResult {
  fileId: string;
  name?: string;
  size?: number;
}

export interface TermsClause {
  number: number;
  title: string;
  body: string;
}
export interface TermsResponse {
  version?: string;
  clauses: TermsClause[];
}

export interface MyCoCreateRequest {
  id: string;
  title: string;
  status: CoCreateStatus;
  statusLabel?: string;
  submittedAt?: string;
}

export interface FieldError {
  field: string;
  message: string;
}

// ---- admin

export interface CoCreateListItem {
  id: string;
  creatorName: string;
  title: string;
  supportType: SupportType;
  product: string;
  status: CoCreateStatus;
  submittedAt: string;
  flags: CoCreateFlag[];
}
export type CoCreateListPage = Paged<CoCreateListItem>;

export interface CoCreateListQuery {
  search?: string;
  status?: string;
  supportType?: string;
  flag?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface CoCreateFileRef {
  id: string;
  name: string;
}

/** Submitted answers, same nested shape the creator form posts (Section 5 comes back as `bank`). */
export interface CoCreateData {
  s1: { title: string; idea: string; product: string; supportType: SupportType };
  s2?: {
    a?: { fee: number; covers: string[]; otherCosts?: string; why: string; milestone: string; gstRegistered: string; gstNumber?: string };
    b?: { product: string; variant: string; why: string; units: number; duration: string; location: string; locationDetails?: string; returnCommitment: boolean };
    c?: { product: string; variant: string; why: string; units: number; unitsReason?: string };
  };
  s3: {
    contentTypes: string[];
    otherType?: string;
    counts: Record<string, number>;
    featured: string;
    concept: string;
    tag: string;
    noTagReason?: string;
    shootDate: string;
    postDate: string;
    reviewBefore: string;
    reviewAck?: boolean;
    reviewDays?: number;
  };
  s4: { platform: string; reach: number; competing: string; competingDetails?: string };
}

export interface CoCreateDetail {
  id: string;
  status: CoCreateStatus;
  flags: CoCreateFlag[];
  submittedAt: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
  campaignTitle?: string | null;
  creator: { id?: string; name: string; email?: string; phone?: string };
  data: CoCreateData;
  files: { ideaDoc?: CoCreateFileRef | null; gstProforma?: CoCreateFileRef | null };
  bank?: {
    holder: string;
    bankName: string;
    accountLast4: string;
    ifsc: string;
    accountType: string;
    upi?: string | null;
    canReveal?: boolean;
  } | null;
  history: { status: CoCreateStatus; note?: string | null; at: string; by?: string | null }[];
}
