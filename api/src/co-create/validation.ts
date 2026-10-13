import {
  ACCOUNT_TYPES,
  BORROW_DURATIONS,
  BORROW_LOCATION_TYPES,
  CC_CONTENT_TYPES,
  FEE_COVERS,
  PAYMENT_MILESTONES,
  PRIMARY_PLATFORMS,
  PRODUCT_VISIBILITY,
  REVIEW_DAYS,
  SUPPORT_TYPES,
  SupportType,
  TERMS_VERSION,
  clausesFor,
  isGiftType,
  isPaidType,
} from './constants';

export interface FieldError {
  field: string;
  message: string;
}

export interface PaymentInput {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  accountType: string;
  upiId: string | null;
}

export interface ValidatedRequest {
  supportType: SupportType;
  /** Columns for co_create_requests (without creator/idempotency/terms metadata). */
  row: Record<string, unknown>;
  payment: PaymentInput | null;
  ideaDocFileId: string | null;
  gstProformaFileId: string | null;
  termsClauseIds: string[];
  flags: string[];
}

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const INT4_MAX = 2147483647;

/** Strip control characters and HTML, then trim. User text is never rendered as HTML. */
export function cleanText(v: string): string {
  return v
    .replace(CONTROL_RE, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

export function parseDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
    ? v
    : null;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Today's calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function todayIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    now,
  );
}

export function validateCoCreate(
  input: unknown,
  today: string,
): { errors: FieldError[]; value: ValidatedRequest | null } {
  const errors: FieldError[] = [];
  const err = (field: string, message: string) =>
    void errors.push({ field, message });
  if (!isObj(input)) {
    return {
      errors: [
        { field: 'body', message: 'Request body must be a JSON object.' },
      ],
      value: null,
    };
  }
  const b = input;

  const text = (
    src: Rec,
    key: string,
    field: string,
    label: string,
    max: number,
    required = true,
  ): string | null => {
    const raw = src[key];
    if (raw === undefined || raw === null) {
      if (required) err(field, `${label} is required.`);
      return null;
    }
    if (typeof raw !== 'string') {
      err(field, `${label} must be text.`);
      return null;
    }
    const s = cleanText(raw);
    if (!s) {
      if (required) err(field, `${label} is required.`);
      return null;
    }
    if (s.length > max) {
      err(field, `${label} must be at most ${max} characters.`);
      return null;
    }
    return s;
  };

  const int = (
    src: Rec,
    key: string,
    field: string,
    label: string,
    min: number,
    max: number,
  ): number | null => {
    const raw = src[key];
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && /^\d{1,10}$/.test(raw.trim())
          ? Number(raw)
          : NaN;
    if (raw === undefined || raw === null || raw === '') {
      err(field, `${label} is required.`);
      return null;
    }
    if (!Number.isInteger(n) || n < min || n > max) {
      err(
        field,
        `${label} must be a whole number${min > 0 ? ` of at least ${min}` : ''}.`,
      );
      return null;
    }
    return n;
  };

  const bool = (
    src: Rec,
    key: string,
    field: string,
    label: string,
  ): boolean | null => {
    const raw = src[key];
    if (typeof raw === 'boolean') return raw;
    err(field, `${label} is required.`);
    return null;
  };

  const oneOf = <T extends string>(
    src: Rec,
    key: string,
    field: string,
    label: string,
    allowed: readonly T[],
  ): T | null => {
    const raw = src[key];
    if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw))
      return raw as T;
    err(
      field,
      raw === undefined || raw === null || raw === ''
        ? `${label} is required.`
        : `${label} is not a valid choice.`,
    );
    return null;
  };

  const list = <T extends string>(
    src: Rec,
    key: string,
    field: string,
    label: string,
    allowed: readonly T[],
  ): T[] | null => {
    const raw = src[key];
    if (!Array.isArray(raw) || !raw.length) {
      err(field, `Choose at least one option for ${label}.`);
      return null;
    }
    const vals = [...new Set(raw)];
    if (
      !vals.every(
        (v) =>
          typeof v === 'string' && (allowed as readonly string[]).includes(v),
      )
    ) {
      err(field, `${label} contains an invalid choice.`);
      return null;
    }
    return vals as T[];
  };

  const uuid = (
    src: Rec,
    key: string,
    field: string,
    label: string,
    required: boolean,
  ): string | null => {
    const raw = src[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) err(field, `${label} is required.`);
      return null;
    }
    if (typeof raw !== 'string' || !UUID_RE.test(raw)) {
      err(field, `${label} is not valid.`);
      return null;
    }
    return raw.toLowerCase();
  };

  // ---------------------------------------------------------- Section 1
  const row: Rec = {};
  row.title = text(b, 'title', '1.1', 'Title', 100);
  row.idea_description = text(
    b,
    'ideaDescription',
    '1.2',
    'Idea description',
    500,
  );
  row.vivo_product = text(b, 'vivoProduct', '1.3', 'Vivo product', 100);
  const ideaDocFileId = uuid(b, 'ideaDocFileId', '1.4', 'Idea document', false);
  row.idea_doc_file_id = ideaDocFileId;
  row.campaign_id = uuid(b, 'campaignId', 'campaignId', 'Campaign', false);
  const supportType = oneOf(
    b,
    'supportType',
    '1.5',
    'Support type',
    SUPPORT_TYPES,
  );
  if (!supportType) return { errors, value: null };
  row.support_type = supportType;

  const paid = isPaidType(supportType);
  const borrow = supportType === 'borrow';
  const gift = isGiftType(supportType);

  // ---------------------------------------------------------- Branch A
  let gstRegistered: boolean | null = null;
  const nullA = [
    'fee_amount_inr',
    'fee_covers',
    'fee_other_items',
    'fee_justification',
    'payment_milestone',
    'gst_registered',
    'gst_number',
  ];
  if (paid) {
    row.fee_amount_inr = int(
      b,
      'feeAmountInr',
      '2A.1',
      'Fee amount',
      1,
      999999999,
    );
    const covers = list(
      b,
      'feeCovers',
      '2A.2',
      'what the fee covers',
      FEE_COVERS,
    );
    row.fee_covers = covers;
    row.fee_other_items = covers?.includes('other')
      ? text(b, 'feeOtherItems', '2A.3', 'Other fee items', 200)
      : null;
    row.fee_justification = text(
      b,
      'feeJustification',
      '2A.4',
      'Fee justification',
      300,
    );
    row.payment_milestone = oneOf(
      b,
      'paymentMilestone',
      '2A.5',
      'Payment milestone',
      PAYMENT_MILESTONES,
    );
    gstRegistered = bool(b, 'gstRegistered', '2A.6', 'GST registration');
    row.gst_registered = gstRegistered;
    row.gst_number = null;
    if (gstRegistered === true) {
      const raw = text(b, 'gstNumber', '2A.7', 'GST number', 40);
      const gst = raw?.toUpperCase() ?? null;
      if (gst && !/^[A-Z0-9]{15}$/.test(gst))
        err('2A.7', 'GST number must be 15 letters or digits.');
      else row.gst_number = gst;
    }
  } else nullA.forEach((k) => (row[k] = null));

  // ---------------------------------------------------------- Branch B
  const nullB = [
    'borrow_product',
    'borrow_variant',
    'borrow_variant_reason',
    'borrow_units',
    'borrow_duration',
    'borrow_location_type',
    'borrow_locations',
    'borrow_return_commitment',
  ];
  if (borrow) {
    row.borrow_product = text(
      b,
      'borrowProduct',
      '2B.1',
      'Product to borrow',
      100,
    );
    row.borrow_variant = text(b, 'borrowVariant', '2B.2', 'Variant', 150);
    row.borrow_variant_reason = text(
      b,
      'borrowVariantReason',
      '2B.3',
      'Reason for this variant',
      200,
    );
    row.borrow_units = int(
      b,
      'borrowUnits',
      '2B.4',
      'Number of units',
      1,
      INT4_MAX,
    );
    row.borrow_duration = oneOf(
      b,
      'borrowDuration',
      '2B.5',
      'Borrow duration',
      BORROW_DURATIONS,
    );
    const loc = oneOf(
      b,
      'borrowLocationType',
      '2B.6',
      'Location type',
      BORROW_LOCATION_TYPES,
    );
    row.borrow_location_type = loc;
    row.borrow_locations =
      loc === 'multiple'
        ? text(b, 'borrowLocations', '2B.7', 'Locations', 200)
        : null;
    const ret = bool(
      b,
      'borrowReturnCommitment',
      '2B.8',
      'Return confirmation',
    );
    if (ret === false)
      err('2B.8', 'You must confirm that the product will be returned.');
    row.borrow_return_commitment = ret === true ? true : null;
  } else nullB.forEach((k) => (row[k] = null));

  // ---------------------------------------------------------- Branch C
  const nullC = [
    'gift_product',
    'gift_variant',
    'gift_variant_reason',
    'gift_units',
    'gift_multi_unit_reason',
  ];
  if (gift) {
    row.gift_product = text(b, 'giftProduct', '2C.1', 'Gifted product', 100);
    row.gift_variant = text(b, 'giftVariant', '2C.2', 'Variant', 150);
    row.gift_variant_reason = text(
      b,
      'giftVariantReason',
      '2C.3',
      'Reason for this variant',
      200,
    );
    const units = int(b, 'giftUnits', '2C.4', 'Number of units', 1, INT4_MAX);
    row.gift_units = units;
    row.gift_multi_unit_reason =
      units !== null && units > 1
        ? text(
            b,
            'giftMultiUnitReason',
            '2C.5',
            'Reason for multiple units',
            200,
          )
        : null;
  } else nullC.forEach((k) => (row[k] = null));

  // ---------------------------------------------------------- Section 3
  const types = list(
    b,
    'contentTypes',
    '3.1',
    'content types',
    CC_CONTENT_TYPES,
  );
  row.content_types = types;
  row.content_type_other = types?.includes('other')
    ? text(b, 'contentTypeOther', '3.2', 'Other content type', 200)
    : null;

  let total: number | null = null;
  const breakdown = b.deliverablesBreakdown;
  if (types) {
    if (!isObj(breakdown))
      err('3.3', 'Enter the number of deliverables for each content type.');
    else {
      const keys = Object.keys(breakdown);
      const extra = keys.filter((k) => !types.includes(k as never));
      const missing = types.filter((t) => !keys.includes(t));
      const bad = keys.filter(
        (k) =>
          !Number.isInteger(breakdown[k]) ||
          (breakdown[k] as number) < 1 ||
          (breakdown[k] as number) > 100000,
      );
      if (extra.length || missing.length || bad.length) {
        err(
          '3.3',
          'Enter a whole number (at least 1) of deliverables for each selected content type, and only for those types.',
        );
      } else {
        const clean: Record<string, number> = {};
        types.forEach((t) => (clean[t] = breakdown[t] as number));
        row.deliverables_breakdown = JSON.stringify(clean);
        total = Object.values(clean).reduce((a, n) => a + n, 0);
        row.total_deliverables = total;
      }
    }
  }
  row.product_visibility = oneOf(
    b,
    'productVisibility',
    '3.4',
    'Product visibility',
    PRODUCT_VISIBILITY,
  );
  row.content_concept = text(
    b,
    'contentConcept',
    '3.5',
    'Content concept',
    400,
  );
  const willTag = bool(b, 'willTag', '3.6', 'Tagging confirmation');
  row.will_tag = willTag;
  row.no_tag_reason =
    willTag === false
      ? text(b, 'noTagReason', '3.7', 'Reason for not tagging', 200)
      : null;

  const shootRaw = b.shootDate;
  const shoot = parseDate(shootRaw);
  if (!shoot)
    err(
      '3.8',
      shootRaw === undefined || shootRaw === null || shootRaw === ''
        ? 'Shoot date is required.'
        : 'Shoot date must be a valid date (YYYY-MM-DD).',
    );
  else if (shoot <= today) err('3.8', 'Shoot date must be after today.');
  row.shoot_date = shoot;

  const postRaw = b.postingDate;
  const post = parseDate(postRaw);
  if (!post)
    err(
      '3.9',
      postRaw === undefined || postRaw === null || postRaw === ''
        ? 'Posting date is required.'
        : 'Posting date must be a valid date (YYYY-MM-DD).',
    );
  else if (shoot && post < addDays(shoot, 2))
    err('3.9', 'Posting date must be at least 2 days after the shoot date.');
  row.posting_date = post;

  const submitForReview = bool(
    b,
    'submitForReview',
    '3.10',
    'Review submission choice',
  );
  row.submit_for_review = submitForReview;
  row.review_reconfirmed = null;
  row.review_days_before = null;
  if (submitForReview === false) {
    if (b.reviewReconfirmed === true) row.review_reconfirmed = true;
    else
      err(
        '3.10a',
        'Please reconfirm that you will not submit the content for review.',
      );
  } else if (submitForReview === true) {
    const days = oneOf(
      b,
      'reviewDaysBefore',
      '3.11',
      'Review days before posting',
      Object.keys(REVIEW_DAYS) as readonly string[],
    );
    row.review_days_before = days;
    if (days && shoot && post && addDays(post, -REVIEW_DAYS[days]) < shoot) {
      err(
        '3.11',
        'The review window starts before the shoot date. Choose fewer days or a later posting date.',
      );
    }
  }

  // ---------------------------------------------------------- Section 4
  row.primary_platform = oneOf(
    b,
    'primaryPlatform',
    '4.1',
    'Primary platform',
    PRIMARY_PLATFORMS,
  );
  row.estimated_reach = int(
    b,
    'estimatedReach',
    '4.2',
    'Estimated reach',
    0,
    INT4_MAX,
  );
  const competing = bool(
    b,
    'competingBrandActive',
    '4.3',
    'Competing brand question',
  );
  row.competing_brand_active = competing;
  row.competing_brand_details =
    competing === true
      ? text(b, 'competingBrandDetails', '4.4', 'Competing brand details', 300)
      : null;
  row.competing_brand_declared = competing === true;

  // ---------------------------------------------------------- Section 5
  let payment: PaymentInput | null = null;
  let gstProformaFileId: string | null = null;
  if (paid) {
    const p = isObj(b.payment) ? b.payment : {};
    const holder = text(
      p,
      'accountHolderName',
      '5.1',
      'Account holder name',
      100,
    );
    if (holder && !/^[A-Za-z .]+$/.test(holder))
      err(
        '5.1',
        'Account holder name can contain only letters, spaces and dots.',
      );
    const bank = text(p, 'bankName', '5.2', 'Bank name', 100);
    const acct = text(p, 'accountNumber', '5.3', 'Account number', 40);
    if (acct && !/^\d{9,18}$/.test(acct))
      err('5.3', 'Account number must be 9 to 18 digits.');
    const confirm =
      typeof p.accountNumberConfirm === 'string'
        ? p.accountNumberConfirm.trim()
        : '';
    if (!confirm) err('5.4', 'Please confirm the account number.');
    else if (acct && confirm !== acct)
      err('5.4', 'Account numbers do not match.');
    const ifscRaw = text(p, 'ifsc', '5.5', 'IFSC code', 40);
    const ifsc = ifscRaw?.toUpperCase() ?? null;
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))
      err('5.5', 'IFSC must be 11 characters, for example HDFC0001234.');
    const accountType = oneOf(
      p,
      'accountType',
      '5.6',
      'Account type',
      ACCOUNT_TYPES,
    );
    const upi = text(p, 'upiId', '5.7', 'UPI ID', 320, false);
    if (upi && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi))
      err('5.7', 'UPI ID is not valid, for example name@bank.');
    if (gstRegistered === true)
      gstProformaFileId = uuid(
        p,
        'gstProformaFileId',
        '5.8',
        'GST proforma invoice',
        true,
      );

    if (
      holder &&
      bank &&
      acct &&
      ifsc &&
      accountType &&
      !errors.some((e) => e.field.startsWith('5.'))
    ) {
      payment = {
        accountHolderName: holder,
        bankName: bank,
        accountNumber: acct,
        ifsc,
        accountType,
        upiId: upi,
      };
    }
  }

  // ---------------------------------------------------------- Terms
  const expected = clausesFor(supportType).map((c) => c.id);
  const sent = Array.isArray(b.termsClauseIds)
    ? b.termsClauseIds.map((x) => String(x))
    : [];
  if (b.termsVersion !== TERMS_VERSION)
    err('terms', `Terms version must be ${TERMS_VERSION}.`);
  else if (b.termsAccepted !== true)
    err('terms', 'You must accept the terms to submit.');
  else if (
    new Set(sent).size !== sent.length ||
    sent.length !== expected.length ||
    !expected.every((id) => sent.includes(id))
  ) {
    err(
      'terms',
      'The terms shown do not match this support type. Please reload and try again.',
    );
  }

  // ---------------------------------------------------------- Flags (server-computed only)
  const flags: string[] = [];
  if (competing === true) flags.push('COMPETING_BRAND_DECLARED');
  if (willTag === false) flags.push('NO_TAG_COMMITMENT');
  if (submitForReview === false) flags.push('REVIEW_NOT_CONFIRMED');
  if (
    ((row.borrow_units as number) ?? 0) > 1 ||
    ((row.gift_units as number) ?? 0) > 1
  )
    flags.push('MULTI_UNIT_REQUEST');
  if (gstRegistered === true) flags.push('GST_REGISTERED');
  row.flags = flags;

  if (errors.length) return { errors, value: null };
  return {
    errors,
    value: {
      supportType,
      row,
      payment,
      ideaDocFileId,
      gstProformaFileId,
      termsClauseIds: expected,
      flags,
    },
  };
}
