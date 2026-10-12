import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from '../db/db.service';
import * as tpl from './templates';

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  creatorId?: string | null;
}

export type MailStatus = 'sent' | 'failed' | 'skipped';

const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';
const BATCH_THRESHOLD = 10;
const BATCH_SIZE = 100;
const MAX_429_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TIER_LABEL: Record<string, string> = {
  core_creator: 'Core Creator',
  campaign_creator: 'Campaign Creator',
  vcc_community: 'VCC Community',
  inactive: 'Inactive',
};

const FOLLOWER_COLUMN: Record<string, string> = {
  instagram: 'instagram_followers',
  youtube: 'youtube_subscribers',
  facebook: 'facebook_followers',
  linkedin: 'linkedin_followers',
  threads: 'threads_followers',
};

interface Recipient {
  id: string;
  full_name: string;
  email: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly from: string;
  private readonly spacingMs: number;
  private readonly adminAlertEmails: string[];
  // Single in-process queue: one provider call at a time, spaced out.
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: DbService,
    config: ConfigService,
  ) {
    this.apiKey = (config.get<string>('RESEND_API_KEY') ?? '').trim();
    this.from =
      (config.get<string>('MAIL_FROM') ?? '').trim() ||
      'VCC Creator Club <noreply@vcreatorclub.in>';
    this.spacingMs = Number(config.get<string>('MAIL_SPACING_MS') ?? 600);
    this.adminAlertEmails = (config.get<string>('ADMIN_ALERT_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }

  private get enabled() {
    return this.apiKey.length > 0;
  }

  // ------------------------------------------------------------------ core
  /** Never throws. */
  async send(input: MailInput): Promise<{ status: MailStatus }> {
    try {
      if (!this.enabled) {
        await this.insertLog(input, 'skipped');
        this.logger.log(
          `email skipped (RESEND_API_KEY not set): to=${input.to} subject="${input.subject}"`,
        );
        return { status: 'skipped' };
      }
      const logId = await this.insertLog(input, 'queued');
      return await this.enqueue(() => this.deliver(logId, input));
    } catch (err) {
      this.logger.error(`email send failed: ${this.errMsg(err)}`);
      return { status: 'failed' };
    }
  }

  /** Never throws. Uses Resend's batch endpoint above BATCH_THRESHOLD recipients. */
  async sendBulk(inputs: MailInput[]): Promise<void> {
    try {
      if (!inputs.length) return;
      if (!this.enabled || inputs.length <= BATCH_THRESHOLD) {
        await Promise.all(inputs.map((i) => this.send(i)));
        return;
      }
      for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
        const chunk = inputs.slice(i, i + BATCH_SIZE);
        const logIds = await Promise.all(
          chunk.map((m) => this.insertLog(m, 'queued')),
        );
        await this.enqueue(() => this.deliverBatch(logIds, chunk));
      }
    } catch (err) {
      this.logger.error(`bulk email failed: ${this.errMsg(err)}`);
    }
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.tail.then(job);
    const gap = () => sleep(this.spacingMs);
    this.tail = run.then(gap, gap);
    return run;
  }

  private payload(m: MailInput) {
    return {
      from: this.from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
    };
  }

  private async post(url: string, body: unknown, idempotencyKey?: string) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 429 && attempt < MAX_429_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(
          Math.min(
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : 1000,
            5000,
          ),
        );
        continue;
      }
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          `Resend ${res.status}: ${json?.message ?? res.statusText}`,
        );
      return json;
    }
  }

  private async deliver(
    logId: string | null,
    m: MailInput,
  ): Promise<{ status: MailStatus }> {
    try {
      const json = await this.post(
        RESEND_URL,
        this.payload(m),
        logId ?? undefined,
      );
      await this.markLog(logId, 'sent', { providerId: json?.id ?? null });
      return { status: 'sent' };
    } catch (err) {
      const msg = this.errMsg(err);
      this.logger.error(
        `email failed: to=${m.to} subject="${m.subject}" ${msg}`,
      );
      await this.markLog(logId, 'failed', { error: msg });
      return { status: 'failed' };
    }
  }

  private async deliverBatch(logIds: (string | null)[], chunk: MailInput[]) {
    try {
      const json = await this.post(
        RESEND_BATCH_URL,
        chunk.map((m) => this.payload(m)),
      );
      const data: { id?: string }[] = Array.isArray(json?.data)
        ? json.data
        : [];
      await Promise.all(
        logIds.map((id, i) =>
          this.markLog(id, 'sent', { providerId: data[i]?.id ?? null }),
        ),
      );
    } catch (err) {
      const msg = this.errMsg(err);
      this.logger.error(
        `batch email failed (${chunk.length} recipients): ${msg}`,
      );
      await Promise.all(
        logIds.map((id) => this.markLog(id, 'failed', { error: msg })),
      );
    }
  }

  // Logging problems (e.g. migration not applied yet) must not block delivery.
  private async insertLog(
    m: MailInput,
    status: 'queued' | 'skipped',
  ): Promise<string | null> {
    try {
      const row = await this.db.one<{ id: string }>(
        `insert into email_log (to_email, creator_id, template, subject, status)
         values ($1, $2, $3, $4, $5) returning id`,
        [m.to, m.creatorId ?? null, m.template, m.subject, status],
      );
      return row?.id ?? null;
    } catch (err) {
      this.logger.warn(`email_log insert failed: ${this.errMsg(err)}`);
      return null;
    }
  }

  private async markLog(
    id: string | null,
    status: 'sent' | 'failed',
    o: { providerId?: string | null; error?: string },
  ) {
    if (!id) return;
    try {
      await this.db.query(
        `update email_log
            set status = $2, provider_id = $3, error = $4,
                sent_at = case when $2 = 'sent' then now() else sent_at end
          where id = $1`,
        [
          id,
          status,
          o.providerId ?? null,
          o.error ? o.error.slice(0, 500) : null,
        ],
      );
    } catch (err) {
      this.logger.warn(`email_log update failed: ${this.errMsg(err)}`);
    }
  }

  private errMsg(err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }

  private async safely(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`${label} failed: ${this.errMsg(err)}`);
    }
  }

  // -------------------------------------------------------------- recipients
  private recipients(ids: string[], optInOnly: boolean): Promise<Recipient[]> {
    return this.db.query<Recipient>(
      `select id, full_name, email from creator_profiles
        where id = any($1::uuid[]) ${optInOnly ? 'and email_opt_in' : ''}`,
      [ids],
    );
  }

  private toInput(
    r: Recipient,
    template: string,
    c: tpl.EmailContent,
  ): MailInput {
    return { to: r.email, creatorId: r.id, template, ...c };
  }

  // ----------------------------------------------------------------- notify*
  // Call these fire-and-forget (`void this.mail.notifyX(...)`) after the DB
  // transaction commits. They never reject.
  notifyEnrollmentReceived(creatorId: string) {
    return this.safely('notifyEnrollmentReceived', async () => {
      const [r] = await this.recipients([creatorId], false);
      if (r)
        await this.send(
          this.toInput(
            r,
            'enrollmentReceived',
            tpl.enrollmentReceived(r.full_name),
          ),
        );
    });
  }

  notifyAdminsOfEnrollment(creatorId: string) {
    return this.safely('notifyAdminsOfEnrollment', async () => {
      if (!this.adminAlertEmails.length) return;
      const p = await this.db.one(
        'select * from creator_profiles where id = $1',
        [creatorId],
      );
      if (!p) return;
      const platform: string = p.core_platform;
      const followers = p[FOLLOWER_COLUMN[platform]] ?? 0;
      const c = tpl.adminEnrollmentAlert(
        p.full_name,
        p.city,
        followers,
        platform,
      );
      await this.sendBulk(
        this.adminAlertEmails.map((to) => ({
          to,
          template: 'adminEnrollmentAlert',
          ...c,
        })),
      );
    });
  }

  notifyApproved(creatorIds: string[]) {
    return this.safely('notifyApproved', async () => {
      if (!creatorIds.length) return;
      const rows = await this.recipients(creatorIds, false);
      await this.sendBulk(
        rows.map((r) => this.toInput(r, 'approved', tpl.approved(r.full_name))),
      );
    });
  }

  notifyRejected(creatorId: string, note?: string | null) {
    return this.safely('notifyRejected', async () => {
      const [r] = await this.recipients([creatorId], false);
      if (r)
        await this.send(
          this.toInput(r, 'rejected', tpl.rejected(r.full_name, note)),
        );
    });
  }

  notifyTierChanged(creatorId: string, tier: string) {
    return this.safely('notifyTierChanged', async () => {
      const [r] = await this.recipients([creatorId], true);
      if (r) {
        await this.send(
          this.toInput(
            r,
            'tierChanged',
            tpl.tierChanged(r.full_name, TIER_LABEL[tier] ?? tier),
          ),
        );
      }
    });
  }

  notifyCampaignOpened(c: {
    title: string;
    product?: string | null;
    deadline?: string | Date | null;
    eligible_tiers: string[];
  }) {
    return this.safely('notifyCampaignOpened', async () => {
      const rows = await this.db.query<Recipient>(
        `select id, full_name, email from creator_profiles
          where status = 'approved' and email_opt_in and tier = any($1::text[])`,
        [c.eligible_tiers],
      );
      await this.sendBulk(
        rows.map((r) =>
          this.toInput(
            r,
            'campaignOpened',
            tpl.campaignOpened(r.full_name, c.title, c.product, c.deadline),
          ),
        ),
      );
    });
  }

  notifyAssignmentUpdate(
    creatorId: string,
    campaignTitle: string,
    status: string,
  ) {
    return this.safely('notifyAssignmentUpdate', async () => {
      const [r] = await this.recipients([creatorId], true);
      if (r) {
        await this.send(
          this.toInput(
            r,
            'assignmentUpdate',
            tpl.assignmentUpdate(r.full_name, campaignTitle, status),
          ),
        );
      }
    });
  }

  notifyCustom(creatorIds: string[], title: string, message: string) {
    return this.safely('notifyCustom', async () => {
      if (!creatorIds.length) return;
      const rows = await this.recipients(creatorIds, true);
      await this.sendBulk(
        rows.map((r) =>
          this.toInput(r, 'custom', tpl.custom(r.full_name, title, message)),
        ),
      );
    });
  }
}
