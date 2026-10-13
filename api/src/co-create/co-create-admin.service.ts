import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from '../db/db.service';
import { AdminContext } from '../auth/auth.types';
import { REQUEST_STATUSES, STATUS_LABEL } from './constants';
import { AUDIT_SQL, cleanIp } from './co-create.service';
import { CoCreateFilesService } from './co-create-files.service';
import { ListCoCreateQuery } from './co-create.dto';
import { decrypt, loadKey } from './crypto';
import { cleanText } from './validation';

const esc = (s: string) => s.replace(/[%_\\]/g, (m) => `\\${m}`);

@Injectable()
export class CoCreateAdminService {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
    private readonly files: CoCreateFilesService,
  ) {}

  async list(q: ListCoCreateQuery) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (q.status) add('r.status = ?', q.status);
    if (q.supportType) add('r.support_type = ?', q.supportType);
    if (q.flag) add('? = any(r.flags)', q.flag);
    if (q.from)
      add(
        `(r.submitted_at at time zone 'Asia/Kolkata')::date >= ?::date`,
        q.from,
      );
    if (q.to)
      add(
        `(r.submitted_at at time zone 'Asia/Kolkata')::date <= ?::date`,
        q.to,
      );
    if (q.q) {
      params.push(`%${esc(q.q)}%`);
      const i = params.length;
      where.push(
        `(r.title ilike $${i} or r.vivo_product ilike $${i} or p.full_name ilike $${i})`,
      );
    }
    const w = where.length ? `where ${where.join(' and ')}` : '';
    const from =
      'from co_create_requests r join creator_profiles p on p.id = r.creator_id';
    const total = await this.db.one<{ n: number }>(
      `select count(*)::int as n ${from} ${w}`,
      params,
    );
    params.push(q.pageSize, (q.page - 1) * q.pageSize);
    const rows = await this.db.query(
      `select r.id, p.full_name, r.title, r.support_type, r.vivo_product, r.status, r.submitted_at, r.flags
         ${from} ${w}
        order by (r.status <> 'pending_review'), r.submitted_at asc
        limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        creatorName: r.full_name,
        title: r.title,
        supportType: r.support_type,
        vivoProduct: r.vivo_product,
        status: r.status,
        statusLabel: STATUS_LABEL[r.status],
        submittedAt: r.submitted_at,
        flags: r.flags,
      })),
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async summary() {
    const rows = await this.db.query<{ status: string; n: number }>(
      'select status, count(*)::int as n from co_create_requests group by status',
    );
    const counts: Record<string, number> = Object.fromEntries(
      REQUEST_STATUSES.map((s) => [s, 0]),
    );
    rows.forEach((r) => (counts[r.status] = r.n));
    const unread = await this.db.one<{ n: number }>(
      'select count(*)::int as n from co_create_admin_notifications where read_at is null',
    );
    return { counts, unreadNotifications: unread?.n ?? 0 };
  }

  async detail(id: string) {
    const r = await this.db.one(
      `select r.*, p.full_name, p.email as creator_email,
              to_char(r.shoot_date, 'YYYY-MM-DD') as shoot_date_s,
              to_char(r.posting_date, 'YYYY-MM-DD') as posting_date_s
         from co_create_requests r join creator_profiles p on p.id = r.creator_id
        where r.id = $1`,
      [id],
    );
    if (!r) throw new NotFoundException();
    const pay = await this.db.one(
      'select * from co_create_payment_details where request_id = $1',
      [id],
    );
    const files = await this.db.query(
      'select id, kind, original_name, mime, size_bytes from co_create_files where request_id = $1',
      [id],
    );
    const history = await this.db.query(
      `select h.from_status, h.to_status, h.note, h.at, u.name as actor_name
         from co_create_status_history h left join users u on u.id = h.actor_id
        where h.request_id = $1 order by h.at`,
      [id],
    );
    const file = (fid: string | null) => {
      const f = files.find((x) => x.id === fid);
      return f
        ? {
            id: f.id,
            originalName: f.original_name,
            mime: f.mime,
            sizeBytes: f.size_bytes,
          }
        : null;
    };
    const paid = r.support_type === 'paid' || r.support_type === 'combined';

    return {
      id: r.id,
      status: r.status,
      statusLabel: STATUS_LABEL[r.status],
      submittedAt: r.submitted_at,
      creator: { id: r.creator_id, name: r.full_name, email: r.creator_email },
      campaignId: r.campaign_id,
      flags: r.flags,
      competingBrandDeclared: r.competing_brand_declared,
      section1: {
        title: r.title,
        ideaDescription: r.idea_description,
        vivoProduct: r.vivo_product,
        ideaDoc: file(r.idea_doc_file_id),
        supportType: r.support_type,
      },
      section2: {
        paid: paid
          ? {
              feeAmountInr: r.fee_amount_inr,
              feeCovers: r.fee_covers,
              feeOtherItems: r.fee_other_items,
              feeJustification: r.fee_justification,
              paymentMilestone: r.payment_milestone,
              gstRegistered: r.gst_registered,
              gstNumber: r.gst_number,
            }
          : null,
        borrow:
          r.support_type === 'borrow'
            ? {
                product: r.borrow_product,
                variant: r.borrow_variant,
                variantReason: r.borrow_variant_reason,
                units: r.borrow_units,
                duration: r.borrow_duration,
                locationType: r.borrow_location_type,
                locations: r.borrow_locations,
                returnCommitment: r.borrow_return_commitment,
              }
            : null,
        gifted: r.gift_product
          ? {
              product: r.gift_product,
              variant: r.gift_variant,
              variantReason: r.gift_variant_reason,
              units: r.gift_units,
              multiUnitReason: r.gift_multi_unit_reason,
            }
          : null,
      },
      section3: {
        contentTypes: r.content_types,
        contentTypeOther: r.content_type_other,
        deliverablesBreakdown: r.deliverables_breakdown,
        totalDeliverables: r.total_deliverables,
        productVisibility: r.product_visibility,
        contentConcept: r.content_concept,
        willTag: r.will_tag,
        noTagReason: r.no_tag_reason,
        shootDate: r.shoot_date_s,
        postingDate: r.posting_date_s,
        submitForReview: r.submit_for_review,
        reviewReconfirmed: r.review_reconfirmed,
        reviewDaysBefore: r.review_days_before,
      },
      section4: {
        primaryPlatform: r.primary_platform,
        estimatedReach: r.estimated_reach,
        competingBrandActive: r.competing_brand_active,
        competingBrandDetails: r.competing_brand_details,
      },
      section5: pay
        ? {
            accountHolderName: pay.account_holder_name,
            bankName: pay.bank_name,
            accountNumberMasked: `${'•'.repeat(6)}${pay.account_number_last4}`,
            ifsc: pay.ifsc,
            accountType: pay.account_type,
            upiId: pay.upi_id,
            gstProforma: file(pay.gst_proforma_file_id),
          }
        : null,
      terms: {
        version: r.terms_version,
        acceptedAt: r.terms_accepted_at,
        clauseIds: r.terms_clause_ids,
      },
      review: { reviewedAt: r.reviewed_at, decisionNote: r.decision_note },
      history: history.map((h) => ({
        from: h.from_status,
        to: h.to_status,
        note: h.note,
        at: h.at,
        actorName: h.actor_name,
      })),
    };
  }

  /** Every call is audited; the number is never logged. */
  async revealAccount(requestId: string, admin: AdminContext, ip?: string) {
    const pay = await this.db.one(
      'select account_number_enc from co_create_payment_details where request_id = $1',
      [requestId],
    );
    if (!pay)
      throw new NotFoundException('No payment details for this request.');
    const key = loadKey(this.config.get<string>('CO_CREATE_ENC_KEY'));
    if (!key)
      throw new ServiceUnavailableException(
        'Encryption key is not configured.',
      );
    await this.db.query(AUDIT_SQL, [
      admin.id,
      admin.role,
      'reveal_account',
      requestId,
      '{}',
      cleanIp(ip),
    ]);
    try {
      return { accountNumber: decrypt(pay.account_number_enc, key) };
    } catch {
      throw new ServiceUnavailableException(
        'Could not decrypt the account number.',
      );
    }
  }

  async fileUrl(
    requestId: string,
    fileId: string,
    admin: AdminContext,
    ip?: string,
  ) {
    const f = await this.db.one(
      'select kind from co_create_files where id = $1 and request_id = $2',
      [fileId, requestId],
    );
    if (!f) throw new NotFoundException();
    await this.db.query(AUDIT_SQL, [
      admin.id,
      admin.role,
      'file_access',
      requestId,
      JSON.stringify({ fileId, kind: f.kind }),
      cleanIp(ip),
    ]);
    return this.files.sign(fileId);
  }

  async decide(
    id: string,
    admin: AdminContext,
    decision: string,
    rawNote: string | undefined,
    ip?: string,
  ) {
    const note = rawNote ? cleanText(rawNote) || null : null;
    if (decision === 'modified' && !note) {
      throw new BadRequestException('Describe the modification in the note.');
    }
    return this.db.tx(async (c) => {
      const cur = await c.query(
        'select status from co_create_requests where id = $1 for update',
        [id],
      );
      if (!cur.rowCount) throw new NotFoundException();
      if (cur.rows[0].status !== 'pending_review') {
        throw new ConflictException(
          'A decision has already been recorded for this request.',
        );
      }
      await c.query(
        `update co_create_requests
            set status = $2, reviewed_by = $3, reviewed_at = now(), decision_note = $4
          where id = $1`,
        [id, decision, admin.id, note],
      );
      await c.query(
        `insert into co_create_status_history (request_id, from_status, to_status, actor_id, note)
         values ($1, 'pending_review', $2, $3, $4)`,
        [id, decision, admin.id, note],
      );
      await c.query(AUDIT_SQL, [
        admin.id,
        admin.role,
        'decision',
        id,
        JSON.stringify({ decision }),
        cleanIp(ip),
      ]);
      return { id, status: decision, statusLabel: STATUS_LABEL[decision] };
    });
  }

  async markRead(adminId: string, ids?: string[]) {
    const rows = await this.db.query(
      `update co_create_admin_notifications set read_at = now(), read_by = $1
        where read_at is null and ($2::uuid[] is null or id = any($2::uuid[])) returning id`,
      [adminId, ids?.length ? ids : null],
    );
    return { marked: rows.length };
  }
}
