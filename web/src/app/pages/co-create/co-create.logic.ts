import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { SupportType } from '../../core/co-create.models';

export interface Option<T = string> {
  value: T;
  label: string;
}

export const SUPPORT_OPTIONS: Option<SupportType>[] = [
  { value: 'paid', label: 'Paid Content (Cash Fee)' },
  { value: 'borrow', label: 'Product Borrow - Return After Use' },
  { value: 'gifted', label: 'Product Gifted - Keep' },
  { value: 'combined', label: 'Combined - Cash Fee + Product to Keep' },
];
export const COVER_OPTIONS: Option[] = [
  { value: 'content_creation', label: 'Content creation / filming' },
  { value: 'video_editing', label: 'Video editing / post-production' },
  { value: 'styling_props', label: 'Styling, props, or set design' },
  { value: 'travel_logistics', label: 'Travel and logistics' },
  { value: 'crew_fees', label: 'Crew or assistant fees' },
  { value: 'other', label: 'Other (specify below)' },
];
export const MILESTONE_OPTIONS: Option[] = [
  { value: 'advance_50_50', label: '50% advance upon contract signing + 50% upon content approval' },
  { value: 'full_on_approval', label: '100% upon content approval and delivery' },
];
export const YES_NO: Option[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
export const DURATION_OPTIONS: Option[] = [
  { value: '1_3_days', label: '1-3 days' },
  { value: '4_7_days', label: '4-7 days' },
  { value: '8_14_days', label: '8-14 days' },
  { value: '15_plus_days', label: '15 days or more' },
];
export const LOCATION_OPTIONS: Option[] = [
  { value: 'own_premises', label: 'On my premises only' },
  { value: 'multiple', label: 'Multiple locations - specify below' },
];
export const CONTENT_TYPE_OPTIONS: Option[] = [
  { value: 'instagram_reel', label: 'Instagram Reel' },
  { value: 'instagram_post', label: 'Instagram Post (Static Image)' },
  { value: 'instagram_stories', label: 'Instagram Stories (minimum 3 frames)' },
  { value: 'youtube_long', label: 'YouTube Video - Long Form (5 minutes or more)' },
  { value: 'youtube_short', label: 'YouTube Short' },
  { value: 'other', label: 'Other - specify below' },
];
export const FEATURED_OPTIONS: Option[] = [
  { value: 'prominent', label: 'Yes - featured prominently throughout' },
  { value: 'partial', label: 'Yes - featured partially / in selected moments' },
  { value: 'mention_only', label: 'No - brand mention or voice-over only' },
];
export const REVIEW_DAY_OPTIONS: Option<number>[] = [
  { value: 1, label: '1 day before' },
  { value: 2, label: '2 days before' },
  { value: 3, label: '3 days before' },
  { value: 5, label: '5 or more days before' },
];
export const PLATFORM_OPTIONS: Option[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'both', label: 'Both' },
];
export const ACCOUNT_TYPE_OPTIONS: Option[] = [
  { value: 'savings', label: 'Savings' },
  { value: 'current', label: 'Current' },
];

export const labelOf = (opts: Option<string | number>[], v: unknown) =>
  opts.find((o) => o.value === v)?.label ?? String(v ?? '—');

// ---- dates (India calendar, ISO yyyy-mm-dd)

export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const isIso = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
export function displayDate(iso: string | null | undefined): string {
  return iso && isIso(iso) ? `${iso.slice(8)} / ${iso.slice(5, 7)} / ${iso.slice(0, 4)}` : '';
}
/** The review window must open on or after the shoot date. */
export function reviewWindowOk(shoot: string, post: string, days: number): boolean {
  return !isIso(shoot) || !isIso(post) || addDays(post, -days) >= shoot;
}

// ---- validators

const msg = (m: string): ValidationErrors => ({ msg: m });
export const GST_RE = /^[A-Z0-9]{15}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_RE = /^\d{9,18}$/;

const trimRequired: ValidatorFn = (c) => (typeof c.value === 'string' && c.value.trim() ? null : { required: true });
const intMin = (min: number): ValidatorFn => (c) =>
  c.value === null || c.value === undefined || c.value === ''
    ? null
    : Number.isInteger(c.value) && c.value >= min
      ? null
      : msg(`Enter a whole number of ${min} or more`);
const minItems = (n: number): ValidatorFn => (c) =>
  Array.isArray(c.value) && c.value.length >= n ? null : msg('Select at least one option');
const mustBeTrue = (m: string): ValidatorFn => (c) => (c.value === true ? null : msg(m));
const regex = (re: RegExp, m: string): ValidatorFn => (c) => (!c.value || re.test(c.value) ? null : msg(m));

const sibling = (c: AbstractControl, name: string) => c.parent?.get(name)?.value as string | undefined;

const shootDateValidator: ValidatorFn = (c) => {
  if (!c.value) return { required: true };
  if (!isIso(c.value)) return msg('Enter a valid date');
  return c.value > todayIso() ? null : msg('Shoot date must be after today');
};
const postDateValidator: ValidatorFn = (c) => {
  if (!c.value) return { required: true };
  if (!isIso(c.value)) return msg('Enter a valid date');
  const shoot = sibling(c, 'shootDate');
  return isIso(shoot) && c.value < addDays(shoot, 2) ? msg('Posting date must be at least 2 days after the shoot date') : null;
};
const reviewDaysValidator: ValidatorFn = (c) => {
  if (c.value === null || c.value === '') return { required: true };
  const shoot = sibling(c, 'shootDate');
  const post = sibling(c, 'postDate');
  return reviewWindowOk(shoot ?? '', post ?? '', Number(c.value)) ? null : msg('Review window starts before your shoot date');
};
const accountConfirmValidator: ValidatorFn = (c) => {
  if (!c.value) return { required: true };
  return c.value === sibling(c, 'account') ? null : msg('Account numbers do not match');
};

// ---- form

const str = (validators: ValidatorFn[] = []) => new FormControl('', { nonNullable: true, validators });
const num = (validators: ValidatorFn[] = []) => new FormControl<number | null>(null, { validators });
const text = (max: number) => str([trimRequired, Validators.maxLength(max)]);
const choice = () => str([Validators.required]);

export function buildForm() {
  return new FormGroup({
    s1: new FormGroup({
      title: text(100),
      idea: text(500),
      product: text(100),
      ideaDoc: new FormControl<string | null>(null),
      supportType: new FormControl<SupportType | ''>('', { nonNullable: true, validators: [Validators.required] }),
    }),
    s2: new FormGroup({
      a: new FormGroup({
        fee: num([Validators.required, intMin(1)]),
        covers: new FormControl<string[]>([], { nonNullable: true, validators: [minItems(1)] }),
        otherCosts: text(200),
        why: text(300),
        milestone: choice(),
        gstRegistered: choice(),
        gstNumber: str([Validators.required, regex(GST_RE, 'GST number must be exactly 15 letters/digits')]),
      }),
      b: new FormGroup({
        product: text(100),
        variant: text(150),
        why: text(200),
        units: num([Validators.required, intMin(1)]),
        duration: choice(),
        location: choice(),
        locationDetails: text(200),
        returnCommitment: new FormControl(false, { nonNullable: true, validators: [mustBeTrue('You must confirm the return commitment')] }),
      }),
      c: new FormGroup({
        product: text(100),
        variant: text(150),
        why: text(200),
        units: num([Validators.required, intMin(1)]),
        unitsReason: text(200),
      }),
    }),
    s3: new FormGroup({
      contentTypes: new FormControl<string[]>([], { nonNullable: true, validators: [minItems(1)] }),
      otherType: text(200),
      counts: new FormGroup<Record<string, FormControl<number | null>>>({}),
      featured: choice(),
      concept: text(400),
      tag: choice(),
      noTagReason: text(200),
      shootDate: str([shootDateValidator]),
      postDate: str([postDateValidator]),
      reviewBefore: choice(),
      reviewAck: new FormControl(false, { nonNullable: true, validators: [mustBeTrue('You must confirm to continue')] }),
      reviewDays: new FormControl<number | null>(null, { validators: [reviewDaysValidator] }),
    }),
    s4: new FormGroup({
      platform: choice(),
      reach: num([Validators.required, intMin(0)]),
      competing: choice(),
      competingDetails: text(300),
    }),
    s5: new FormGroup({
      holder: text(100),
      bank: text(100),
      account: str([Validators.required, regex(ACCOUNT_RE, 'Account number must be 9-18 digits')]),
      accountConfirm: str([accountConfirmValidator]),
      ifsc: str([Validators.required, regex(IFSC_RE, 'IFSC must look like HDFC0001234')]),
      accountType: choice(),
      upi: str([Validators.maxLength(100)]),
      gstProforma: new FormControl<string | null>(null, { validators: [Validators.required] }),
    }),
    s6: new FormGroup({
      agreed: new FormControl(false, { nonNullable: true, validators: [mustBeTrue('You must accept the terms and conditions')] }),
    }),
  });
}
export type CoCreateForm = ReturnType<typeof buildForm>;
export type CoCreateRaw = ReturnType<CoCreateForm['getRawValue']>;

// ---- visibility

export function visibility(v: CoCreateRaw) {
  const st = v.s1.supportType;
  const a = st === 'paid' || st === 'combined';
  const b = st === 'borrow';
  const c = st === 'gifted' || st === 'combined';
  const gst = a && v.s2.a.gstRegistered === 'yes';
  return {
    a,
    b,
    c,
    otherCosts: a && v.s2.a.covers.includes('other'),
    gst,
    locationDetails: b && v.s2.b.location === 'multiple',
    unitsReason: c && (v.s2.c.units ?? 0) > 1,
    otherType: v.s3.contentTypes.includes('other'),
    noTagReason: v.s3.tag === 'no',
    reviewAck: v.s3.reviewBefore === 'no',
    reviewDays: v.s3.reviewBefore === 'yes',
    competingDetails: v.s4.competing === 'yes',
    s5: a,
  };
}
export type Visibility = ReturnType<typeof visibility>;

/** Control path -> visibility flag that must be true for the control to be active. */
export const CONTROL_RULES: Record<string, keyof Visibility> = {
  's2.a.fee': 'a', 's2.a.covers': 'a', 's2.a.otherCosts': 'otherCosts', 's2.a.why': 'a', 's2.a.milestone': 'a',
  's2.a.gstRegistered': 'a', 's2.a.gstNumber': 'gst',
  's2.b.product': 'b', 's2.b.variant': 'b', 's2.b.why': 'b', 's2.b.units': 'b', 's2.b.duration': 'b',
  's2.b.location': 'b', 's2.b.locationDetails': 'locationDetails', 's2.b.returnCommitment': 'b',
  's2.c.product': 'c', 's2.c.variant': 'c', 's2.c.why': 'c', 's2.c.units': 'c', 's2.c.unitsReason': 'unitsReason',
  's3.otherType': 'otherType', 's3.noTagReason': 'noTagReason', 's3.reviewAck': 'reviewAck', 's3.reviewDays': 'reviewDays',
  's4.competingDetails': 'competingDetails',
  's5.holder': 's5', 's5.bank': 's5', 's5.account': 's5', 's5.accountConfirm': 's5', 's5.ifsc': 's5',
  's5.accountType': 's5', 's5.upi': 's5', 's5.gstProforma': 'gst',
};

/** Spec field id -> control path, in form order. Drives error mapping, jump-to-field and the remaining count. */
export const FIELD_PATHS: Record<string, string> = {
  '1.1': 's1.title', '1.2': 's1.idea', '1.3': 's1.product', '1.4': 's1.ideaDoc', '1.5': 's1.supportType',
  '2A.1': 's2.a.fee', '2A.2': 's2.a.covers', '2A.3': 's2.a.otherCosts', '2A.4': 's2.a.why', '2A.5': 's2.a.milestone',
  '2A.6': 's2.a.gstRegistered', '2A.7': 's2.a.gstNumber',
  '2B.1': 's2.b.product', '2B.2': 's2.b.variant', '2B.3': 's2.b.why', '2B.4': 's2.b.units', '2B.5': 's2.b.duration',
  '2B.6': 's2.b.location', '2B.7': 's2.b.locationDetails', '2B.8': 's2.b.returnCommitment',
  '2C.1': 's2.c.product', '2C.2': 's2.c.variant', '2C.3': 's2.c.why', '2C.4': 's2.c.units', '2C.5': 's2.c.unitsReason',
  '3.1': 's3.contentTypes', '3.2': 's3.otherType', '3.3': 's3.counts', '3.4': 's3.featured', '3.5': 's3.concept',
  '3.6': 's3.tag', '3.7': 's3.noTagReason', '3.8': 's3.shootDate', '3.9': 's3.postDate', '3.10': 's3.reviewBefore',
  '3.10a': 's3.reviewAck', '3.11': 's3.reviewDays',
  '4.1': 's4.platform', '4.2': 's4.reach', '4.3': 's4.competing', '4.4': 's4.competingDetails',
  '5.1': 's5.holder', '5.2': 's5.bank', '5.3': 's5.account', '5.4': 's5.accountConfirm', '5.5': 's5.ifsc',
  '5.6': 's5.accountType', '5.7': 's5.upi', '5.8': 's5.gstProforma',
  '6': 's6.agreed',
};

export const sectionOf = (fieldId: string) => Number(fieldId.match(/^\d+/)![0]);

/** Enable/disable and clear conditional controls; add/remove one count input per selected content type. */
export function syncForm(form: CoCreateForm): Visibility {
  const vis = visibility(form.getRawValue());
  for (const [path, flag] of Object.entries(CONTROL_RULES)) {
    const ctrl = form.get(path)!;
    if (vis[flag]) {
      if (ctrl.disabled) ctrl.enable({ emitEvent: false });
    } else if (ctrl.enabled) {
      ctrl.reset(undefined, { emitEvent: false });
      ctrl.disable({ emitEvent: false });
    }
  }

  const types = form.controls.s3.controls.contentTypes.value;
  const counts = form.controls.s3.controls.counts;
  for (const o of CONTENT_TYPE_OPTIONS) {
    const present = counts.contains(o.value);
    if (types.includes(o.value) && !present) {
      counts.addControl(o.value, new FormControl<number | null>(null, { validators: [Validators.required, intMin(1)] }), { emitEvent: false });
    } else if (!types.includes(o.value) && present) {
      (counts as FormGroup).removeControl(o.value, { emitEvent: false });
    }
  }

  // Cross-field rules depend on siblings that may have just changed.
  const s3 = form.controls.s3.controls;
  s3.postDate.updateValueAndValidity({ emitEvent: false });
  if (s3.reviewDays.enabled) s3.reviewDays.updateValueAndValidity({ emitEvent: false });
  const confirm = form.controls.s5.controls.accountConfirm;
  if (confirm.enabled) confirm.updateValueAndValidity({ emitEvent: false });
  form.updateValueAndValidity({ emitEvent: false });
  return vis;
}

/** Field ids that are currently active and invalid, in form order. */
export function invalidFieldIds(form: CoCreateForm): string[] {
  return Object.entries(FIELD_PATHS)
    .filter(([, path]) => {
      const c = form.get(path);
      return !!c && c.enabled && c.invalid;
    })
    .map(([id]) => id);
}

export function totalPieces(counts: Record<string, number | null>): number {
  return Object.values(counts).reduce<number>((n, v) => n + (v ?? 0), 0);
}

/** Request body. Disabled (hidden) controls are omitted by `form.value`; the confirm field never leaves the browser. */
export function toPayload(form: CoCreateForm, campaignId: string | null, termsVersion: string | null) {
  const { s5, ...rest } = form.value;
  const bank = s5 ? (({ accountConfirm: _drop, ...b }) => b)(s5) : undefined;
  return { campaignId, termsVersion, ...rest, ...(bank ? { s5: bank } : {}) };
}

// ---- draft (never contains Section 5, uploaded files or the terms tick)

const DRAFT_KEY = 'vcc-cocreate-draft-v1';

export function saveDraft(form: CoCreateForm) {
  const { s5: _s5, s6: _s6, ...raw } = form.getRawValue();
  const { ideaDoc: _doc, ...s1 } = raw.s1;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...raw, s1 }));
  } catch {
    /* storage full or blocked — drafts are best effort */
  }
}
export function loadDraft(form: CoCreateForm): boolean {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const { s1, s2, s3, s4 } = JSON.parse(raw) ?? {};
    const patch = { s1, s2, s3, s4 } as never;
    form.patchValue(patch, { emitEvent: false });
    syncForm(form);
    form.patchValue(patch, { emitEvent: false });
    return true;
  } catch {
    clearDraft();
    return false;
  }
}
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
