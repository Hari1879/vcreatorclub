import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'net';
import { DbService } from '../db/db.service';
import { MailService } from '../mail/mail.service';
import {
  STATUS_LABEL,
  SUBMIT_MESSAGE,
  SupportType,
  TERMS_VERSION,
  clausesFor,
} from './constants';
import { encrypt, loadKey } from './crypto';
import { FieldError, todayIst, validateCoCreate } from './validation';

export const SUBMISSIONS_PER_DAY = 5;
const IDEMPOTENCY_RE = /^[A-Za-z0-9_\-:.]{8,128}$/;

export const AUDIT_SQL = `insert into co_create_audit_log (actor_id, actor_role, action, request_id, meta, ip)
                          values ($1, $2, $3, $4, $5, $6)`;
export const cleanIp = (ip?: string) => (ip && isIP(ip) ? ip : null);

@Injectable()
export class CoCreateService {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  terms(supportType: SupportType) {
    return {
      version: TERMS_VERSION,
      supportType,
      clauses: clausesFor(supportType),
    };
  }

  private response(id: string) {
    return {
      id,
      status: 'pending_review',
      statusLabel: STATUS_LABEL.pending_review,
      message: SUBMIT_MESSAGE,
    };
  }

  async submit(
    creatorId: string,
    idempotencyKey: string | undefined,
    body: unknown,
    ip?: string,
    userAgent?: string,
  ) {
    if (!idempotencyKey || !IDEMPOTENCY_RE.test(idempotencyKey)) {
      throw new BadRequestException(
        'A valid Idempotency-Key header is required.',
      );
    }

    const creator = await this.db.one<{ status: string; full_name: string }>(
      'select status, full_name from creator_profiles where id = $1',
      [creatorId],
    );
    if (!creator || creator.status !== 'approved') {
      throw new ForbiddenException(
        'Co-Create requests are available to approved creators.',
      );
    }

    const replay = await this.findByKey(creatorId, idempotencyKey);
    if (replay) return this.response(replay);

    const recent = await this.db.one<{ n: number }>(
      `select count(*)::int as n from co_create_requests
        where creator_id = $1 and submitted_at > now() - interval '24 hours'`,
      [creatorId],
    );
    if ((recent?.n ?? 0) >= SUBMISSIONS_PER_DAY) {
      throw new HttpException(
        `You can submit up to ${SUBMISSIONS_PER_DAY} Co-Create requests in 24 hours. Please try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { errors, value } = validateCoCreate(body, todayIst());
    const fileErrors = value
      ? await this.fileErrors(
          creatorId,
          value.ideaDocFileId,
          value.gstProformaFileId,
        )
      : [];
    const campaignErrors = value
      ? await this.campaignErrors(value.row.campaign_id as string | null)
      : [];
    const all = [...errors, ...fileErrors, ...campaignErrors];
    if (all.length || !value)
      throw new UnprocessableEntityException({ errors: all });

    const key = loadKey(this.config.get<string>('CO_CREATE_ENC_KEY'));
    if (value.payment && !key) {
      throw new ServiceUnavailableException(
        'Paid requests are temporarily unavailable. Please contact the V Team.',
      );
    }

    try {
      const id = await this.db.tx(async (c) => {
        const cols: Record<string, unknown> = {
          ...value.row,
          creator_id: creatorId,
          idempotency_key: idempotencyKey,
          terms_version: TERMS_VERSION,
          terms_accepted_at: new Date(),
          terms_clause_ids: value.termsClauseIds,
          terms_ip: cleanIp(ip),
          terms_user_agent: userAgent ? userAgent.slice(0, 400) : null,
        };
        const keys = Object.keys(cols);
        const ins = await c.query(
          `insert into co_create_requests (${keys.join(', ')})
           values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
          keys.map((k) => cols[k]),
        );
        const requestId: string = ins.rows[0].id;

        if (value.payment && key) {
          const p = value.payment;
          await c.query(
            `insert into co_create_payment_details
               (request_id, account_holder_name, bank_name, account_number_enc, account_number_last4,
                ifsc, account_type, upi_id, gst_proforma_file_id)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              requestId,
              p.accountHolderName,
              p.bankName,
              encrypt(p.accountNumber, key),
              p.accountNumber.slice(-4),
              p.ifsc,
              p.accountType,
              p.upiId,
              value.gstProformaFileId,
            ],
          );
        }

        const fileIds = [value.ideaDocFileId, value.gstProformaFileId].filter(
          (x): x is string => !!x,
        );
        if (fileIds.length) {
          const att = await c.query(
            `update co_create_files set request_id = $1
              where id = any($2::uuid[]) and creator_id = $3 and request_id is null`,
            [requestId, fileIds, creatorId],
          );
          if (att.rowCount !== new Set(fileIds).size) {
            throw new ConflictException(
              'An uploaded file is no longer available. Please upload it again.',
            );
          }
        }

        await c.query(
          'insert into co_create_status_history (request_id, from_status, to_status, actor_id) values ($1, null, $2, $3)',
          [requestId, 'pending_review', creatorId],
        );
        await c.query(
          'insert into co_create_admin_notifications (request_id) values ($1)',
          [requestId],
        );
        await c.query(AUDIT_SQL, [
          creatorId,
          'creator',
          'submit',
          requestId,
          JSON.stringify({
            supportType: value.supportType,
            flags: value.flags,
          }),
          cleanIp(ip),
        ]);
        return requestId;
      });

      void this.mail.notifyCoCreateSubmitted(
        creator.full_name,
        value.row.title as string,
        value.supportType,
      );
      return this.response(id);
    } catch (err: any) {
      // A concurrent request with the same key won the race: return its result.
      if (err?.code === '23505' && err?.constraint === 'uq_cc_requests_idem') {
        const existing = await this.findByKey(creatorId, idempotencyKey);
        if (existing) return this.response(existing);
      }
      throw err;
    }
  }

  private async findByKey(creatorId: string, key: string) {
    const r = await this.db.one<{ id: string }>(
      'select id from co_create_requests where creator_id = $1 and idempotency_key = $2',
      [creatorId, key],
    );
    return r?.id ?? null;
  }

  private async fileErrors(
    creatorId: string,
    ideaId: string | null,
    gstId: string | null,
  ): Promise<FieldError[]> {
    const errs: FieldError[] = [];
    const check = async (
      id: string | null,
      kind: string,
      field: string,
      label: string,
    ) => {
      if (!id) return;
      const f = await this.db.one(
        `select 1 from co_create_files
          where id = $1 and creator_id = $2 and kind = $3 and request_id is null`,
        [id, creatorId, kind],
      );
      if (!f)
        errs.push({
          field,
          message: `${label} was not found. Please upload it again.`,
        });
    };
    await check(ideaId, 'idea_doc', '1.4', 'Idea document');
    await check(gstId, 'gst_proforma', '5.8', 'GST proforma invoice');
    return errs;
  }

  private async campaignErrors(
    campaignId: string | null,
  ): Promise<FieldError[]> {
    if (!campaignId) return [];
    const c = await this.db.one('select 1 from campaigns where id = $1', [
      campaignId,
    ]);
    return c
      ? []
      : [{ field: 'campaignId', message: 'Campaign was not found.' }];
  }

  async mine(creatorId: string) {
    const rows = await this.db.query(
      `select id, title, support_type, status, submitted_at from co_create_requests
        where creator_id = $1 order by submitted_at desc`,
      [creatorId],
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      supportType: r.support_type,
      status: r.status,
      statusLabel: STATUS_LABEL[r.status],
      submittedAt: r.submitted_at,
    }));
  }
}
