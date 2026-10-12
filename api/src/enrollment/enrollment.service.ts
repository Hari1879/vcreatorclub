import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { MailService } from '../mail/mail.service';
import {
  SubmitEnrollmentDto,
  corePlatformError,
  profileColumns,
  sqlSet,
} from '../common/profile.dto';

export type TokenState = 'valid' | 'invalid' | 'expired' | 'exhausted';

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly db: DbService,
    private readonly mail: MailService,
  ) {}

  async tokenState(token: string): Promise<{ state: TokenState; label?: string }> {
    if (!/^vcc-[a-f0-9]{32}$/.test(token ?? '')) return { state: 'invalid' };
    const t = await this.db.one(
      `select label, is_active, expires_at, used_count, max_uses,
              expires_at <= now() as is_expired
         from enrollment_tokens where token = $1`,
      [token],
    );
    if (!t || !t.is_active) return { state: 'invalid' };
    if (t.is_expired) return { state: 'expired' };
    if (t.used_count >= t.max_uses) return { state: 'exhausted' };
    return { state: 'valid', label: t.label ?? undefined };
  }

  private async assertTokenUsable(token: string) {
    const { state } = await this.tokenState(token);
    if (state === 'expired') throw new GoneException('This enrollment link has expired.');
    if (state !== 'valid') throw new BadRequestException('This link is not valid.');
  }

  async saveDraft(draftId: string, token: string, step: number, data: Record<string, unknown>) {
    await this.assertTokenUsable(token);
    // Never keep consent ticks in the server draft.
    const { consentEnroll, consentConfidentiality, ...clean } = data as any;
    const row = await this.db.one(
      `insert into enrollment_drafts (draft_id, token, step, data, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (draft_id) do update
         set step = excluded.step, data = excluded.data, updated_at = now()
         where enrollment_drafts.token = excluded.token
       returning updated_at`,
      [draftId, token, step, JSON.stringify(clean)],
    );
    if (!row) throw new BadRequestException('Draft belongs to a different link.');
    return { savedAt: row.updated_at };
  }

  async getDraft(draftId: string, token: string) {
    const row = await this.db.one(
      'select step, data, updated_at from enrollment_drafts where draft_id = $1 and token = $2',
      [draftId, token],
    );
    if (!row) throw new NotFoundException();
    return { step: row.step, data: row.data, savedAt: row.updated_at };
  }

  async submit(userId: string, dto: SubmitEnrollmentDto) {
    const coreErr = corePlatformError(dto);
    if (coreErr) throw new BadRequestException(coreErr);

    const result = await this.db.tx(async (c) => {
      const existing = await c.query('select status from creator_profiles where id = $1', [userId]);
      if (existing.rowCount) {
        throw new ConflictException({
          message: 'You have already enrolled in VCC with this Google account.',
          status: existing.rows[0].status,
        });
      }

      // Atomic: only increments if the token is still usable.
      const tok = await c.query(
        `update enrollment_tokens
            set used_count = used_count + 1
          where token = $1 and is_active and expires_at > now() and used_count < max_uses
          returning token`,
        [dto.token],
      );
      if (!tok.rowCount) {
        const { state } = await this.tokenState(dto.token);
        if (state === 'expired') throw new GoneException('This enrollment link has expired.');
        throw new BadRequestException('This link is not valid.');
      }

      const cols = {
        id: userId,
        ...profileColumns(dto),
        enrollment_token: dto.token,
        consent_enroll: true,
        consent_confidentiality: true,
        consent_at: new Date(),
      };
      const s = sqlSet(cols);
      await c.query(
        `insert into creator_profiles (${s.keys.join(', ')}) values (${s.placeholders})`,
        s.values,
      );

      if (dto.draftId && /^[0-9a-f-]{36}$/i.test(dto.draftId)) {
        await c.query('delete from enrollment_drafts where draft_id = $1', [dto.draftId]);
      }
      return { ok: true, status: 'pending' };
    });
    void this.mail.notifyEnrollmentReceived(userId);
    void this.mail.notifyAdminsOfEnrollment(userId);
    return result;
  }
}
