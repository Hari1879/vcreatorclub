import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { mapCampaign, mapProfile } from '../common/profile.mapper';
import {
  AssignmentUpdateDto,
  CampaignDto,
  CreateTokenDto,
  ListCreatorsQuery,
  SendNotificationDto,
  UpdateCreatorDto,
} from './admin.dto';

const TIER_LABEL: Record<string, string> = {
  core_creator: 'Core Creator',
  campaign_creator: 'Campaign Creator',
  vcc_community: 'VCC Community',
  inactive: 'Inactive',
};

@Injectable()
export class AdminService {
  constructor(private readonly db: DbService) {}

  // ------------------------------------------------------------------ stats
  async stats() {
    const r = await this.db.one(
      `select
         (select count(*) from creator_profiles)::int                         as total,
         (select count(*) from creator_profiles where status = 'pending')::int  as pending,
         (select count(*) from creator_profiles where status = 'approved')::int as approved,
         (select count(*) from campaigns where status = 'open')::int           as active_campaigns`,
    );
    const recent = await this.db.query(
      `select * from creator_profiles order by enrolled_at desc limit 10`,
    );
    return {
      totalEnrolled: r.total,
      pending: r.pending,
      approved: r.approved,
      activeCampaigns: r.active_campaigns,
      recent: recent.map(mapProfile),
    };
  }

  // --------------------------------------------------------------- creators
  async listCreators(q: ListCreatorsQuery) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (q.search) {
      params.push(`%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
      const i = params.length;
      where.push(
        `(full_name ilike $${i} or instagram_handle ilike $${i} or city ilike $${i} or email ilike $${i})`,
      );
    }
    if (q.status) {
      params.push(q.status);
      where.push(`status = $${params.length}`);
    }
    if (q.tier) {
      params.push(q.tier);
      where.push(`tier = $${params.length}`);
    }
    const w = where.length ? `where ${where.join(' and ')}` : '';
    const total = await this.db.one<{ n: number }>(
      `select count(*)::int as n from creator_profiles ${w}`,
      params,
    );
    params.push(q.pageSize, (q.page - 1) * q.pageSize);
    const rows = await this.db.query(
      `select * from creator_profiles ${w}
        order by enrolled_at desc
        limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    return { items: rows.map(mapProfile), total: total?.n ?? 0, page: q.page, pageSize: q.pageSize };
  }

  async getCreator(id: string) {
    const row = await this.db.one('select * from creator_profiles where id = $1', [id]);
    if (!row) throw new NotFoundException();
    const assignments = await this.db.query(
      `select a.id, a.status, a.created_at, c.title, c.product
         from campaign_assignments a join campaigns c on c.id = a.campaign_id
        where a.creator_id = $1 order by a.created_at desc`,
      [id],
    );
    return {
      ...mapProfile(row),
      assignments: assignments.map((a) => ({
        id: a.id,
        status: a.status,
        createdAt: a.created_at,
        title: a.title,
        product: a.product,
      })),
    };
  }

  private notify(c: PoolClient, creatorId: string, title: string, message: string, type: string) {
    return c.query(
      'insert into notifications (creator_id, title, message, type) values ($1, $2, $3, $4)',
      [creatorId, title, message, type],
    );
  }

  async approve(adminId: string, ids: string[]) {
    return this.db.tx(async (c) => {
      const res = await c.query(
        `update creator_profiles
            set status = 'approved', approved_at = now(), approved_by = $2
          where id = any($1::uuid[]) and status <> 'approved'
          returning id`,
        [ids, adminId],
      );
      for (const r of res.rows) {
        await this.notify(
          c,
          r.id,
          'Application approved',
          'Your VCC application has been approved! Welcome to V Creater Club.',
          'approval',
        );
      }
      return { approved: res.rowCount };
    });
  }

  async reject(id: string, note?: string) {
    return this.db.tx(async (c) => {
      const res = await c.query(
        `update creator_profiles
            set status = 'rejected',
                admin_notes = case when $2::text is null then admin_notes
                                   else concat_ws(E'\\n', admin_notes, 'Rejection note: ' || $2) end
          where id = $1 returning id`,
        [id, note || null],
      );
      if (!res.rowCount) throw new NotFoundException();
      await this.notify(
        c,
        id,
        'Application update',
        note
          ? `Thank you for your interest in VCC. Your application was not approved at this time. Note from the team: ${note}`
          : 'Thank you for your interest in VCC. Your application was not approved at this time.',
        'alert',
      );
      return { ok: true };
    });
  }

  async updateCreator(id: string, dto: UpdateCreatorDto) {
    return this.db.tx(async (c) => {
      const before = await c.query('select tier, status from creator_profiles where id = $1 for update', [id]);
      if (!before.rowCount) throw new NotFoundException();
      const sets: string[] = [];
      const params: unknown[] = [id];
      if (dto.tier) {
        params.push(dto.tier);
        sets.push(`tier = $${params.length}`);
      }
      if (dto.status) {
        params.push(dto.status);
        sets.push(`status = $${params.length}`);
      }
      if (dto.adminNotes !== undefined) {
        params.push(dto.adminNotes);
        sets.push(`admin_notes = $${params.length}`);
      }
      if (!sets.length) throw new BadRequestException('Nothing to update.');
      const row = (await c.query(`update creator_profiles set ${sets.join(', ')} where id = $1 returning *`, params))
        .rows[0];
      if (dto.tier && dto.tier !== before.rows[0].tier && row.status === 'approved') {
        await this.notify(c, id, 'Tier updated', `Your VCC tier is now ${TIER_LABEL[dto.tier]}.`, 'info');
      }
      return mapProfile(row);
    });
  }

  // -------------------------------------------------------------- campaigns
  async listCampaigns() {
    const rows = await this.db.query(
      `select c.*, (select count(*) from campaign_assignments a where a.campaign_id = c.id) as assignment_count
         from campaigns c order by c.created_at desc`,
    );
    return rows.map(mapCampaign);
  }

  private campaignCols(dto: CampaignDto) {
    return [
      dto.title,
      dto.description ?? null,
      dto.product,
      dto.campaignType,
      dto.campaignType === 'paid' ? (dto.budgetInr ?? null) : null,
      dto.deliverables.map((d) => d.trim()).filter(Boolean),
      dto.deadline ?? null,
      dto.eligibleTiers,
      dto.maxCreators ?? null,
    ];
  }

  async createCampaign(adminId: string, dto: CampaignDto) {
    const row = await this.db.one(
      `insert into campaigns (title, description, product, campaign_type, budget_inr, deliverables,
                              deadline, eligible_tiers, max_creators, status, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
      [...this.campaignCols(dto), dto.status ?? 'draft', adminId],
    );
    if (row.status === 'open') await this.announceCampaign(row);
    return mapCampaign(row);
  }

  async updateCampaign(id: string, dto: CampaignDto) {
    const prev = await this.db.one('select status from campaigns where id = $1', [id]);
    if (!prev) throw new NotFoundException();
    const status = dto.status && prev.status === 'draft' ? dto.status : prev.status;
    const row = await this.db.one(
      `update campaigns set title = $2, description = $3, product = $4, campaign_type = $5, budget_inr = $6,
              deliverables = $7, deadline = $8, eligible_tiers = $9, max_creators = $10, status = $11
        where id = $1 returning *`,
      [id, ...this.campaignCols(dto), status],
    );
    if (prev.status !== 'open' && row.status === 'open') await this.announceCampaign(row);
    return mapCampaign(row);
  }

  async setCampaignStatus(id: string, status: string) {
    const prev = await this.db.one('select status from campaigns where id = $1', [id]);
    if (!prev) throw new NotFoundException();
    const row = await this.db.one('update campaigns set status = $2 where id = $1 returning *', [id, status]);
    if (prev.status !== 'open' && status === 'open') await this.announceCampaign(row);
    return mapCampaign(row);
  }

  /** When a campaign opens, notify every approved creator in an eligible tier. */
  private async announceCampaign(c: any) {
    await this.db.query(
      `insert into notifications (creator_id, title, message, type)
       select id, $1, $2, 'campaign' from creator_profiles
        where status = 'approved' and tier = any($3::text[])`,
      [
        'New campaign available',
        `${c.title}${c.product ? ` (${c.product})` : ''} is now open. Check the Campaigns tab for details.`,
        c.eligible_tiers,
      ],
    );
  }

  async deleteCampaign(id: string) {
    const res = await this.db.query('delete from campaigns where id = $1 returning id', [id]);
    if (!res.length) throw new NotFoundException();
    return { ok: true };
  }

  async campaignDetail(id: string) {
    const row = await this.db.one('select * from campaigns where id = $1', [id]);
    if (!row) throw new NotFoundException();
    const assignments = await this.db.query(
      `select a.*, p.full_name, p.phone, p.instagram_handle, p.city, p.tier
         from campaign_assignments a join creator_profiles p on p.id = a.creator_id
        where a.campaign_id = $1 order by a.created_at desc`,
      [id],
    );
    return {
      ...mapCampaign(row),
      assignments: assignments.map((a) => ({
        id: a.id,
        creatorId: a.creator_id,
        fullName: a.full_name,
        phone: a.phone,
        instagramHandle: a.instagram_handle,
        city: a.city,
        tier: a.tier,
        status: a.status,
        contentUrl: a.content_url,
        adminNotes: a.admin_notes,
        createdAt: a.created_at,
      })),
    };
  }

  async updateAssignment(id: string, dto: AssignmentUpdateDto) {
    return this.db.tx(async (c) => {
      const prev = await c.query(
        `select a.status, a.creator_id, c.title from campaign_assignments a
           join campaigns c on c.id = a.campaign_id where a.id = $1 for update of a`,
        [id],
      );
      if (!prev.rowCount) throw new NotFoundException();
      const p = prev.rows[0];
      const status = dto.status ?? p.status;
      const row = (
        await c.query(
          `update campaign_assignments
              set status = $2,
                  admin_notes = coalesce($3, admin_notes),
                  accepted_at  = case when $2 = 'accepted'  and accepted_at  is null then now() else accepted_at end,
                  submitted_at = case when $2 = 'submitted' and submitted_at is null then now() else submitted_at end,
                  completed_at = case when $2 = 'completed' and completed_at is null then now() else completed_at end
            where id = $1 returning *`,
          [id, status, dto.adminNotes ?? null],
        )
      ).rows[0];
      if (dto.status && dto.status !== p.status) {
        const msg: Record<string, string> = {
          accepted: `You have been selected for "${p.title}". The VCC team will reach out with next steps.`,
          declined: `Thank you for your interest in "${p.title}". You were not selected this time.`,
          completed: `Your work on "${p.title}" has been marked complete. Thank you!`,
          cancelled: `Your participation in "${p.title}" has been cancelled.`,
        };
        if (msg[dto.status]) await this.notify(c, p.creator_id, 'Campaign update', msg[dto.status], 'campaign');
      }
      return { id: row.id, status: row.status };
    });
  }

  // ----------------------------------------------------------------- tokens
  async listTokens() {
    const rows = await this.db.query(
      `select *, case when not is_active then 'inactive'
                      when expires_at <= now() then 'expired'
                      when used_count >= max_uses then 'exhausted'
                      else 'active' end as state
         from enrollment_tokens order by created_at desc`,
    );
    return rows.map(mapToken);
  }

  async createToken(adminId: string, dto: CreateTokenDto) {
    const expires = new Date(dto.expiresAt);
    if (expires <= new Date()) throw new BadRequestException('Expiry must be in the future.');
    const token = `vcc-${randomBytes(16).toString('hex')}`; // vcc- + 32 hex chars, server-side only
    const row = await this.db.one(
      `insert into enrollment_tokens (token, label, is_event_token, max_uses, expires_at, created_by)
       values ($1, $2, $3, $4, $5, $6) returning *, 'active' as state`,
      [token, dto.label, dto.isEventToken, dto.maxUses, expires, adminId],
    );
    return mapToken(row);
  }

  async setTokenActive(id: string, isActive: boolean) {
    const row = await this.db.one(
      `update enrollment_tokens set is_active = $2 where id = $1
       returning *, case when not is_active then 'inactive'
                         when expires_at <= now() then 'expired'
                         when used_count >= max_uses then 'exhausted'
                         else 'active' end as state`,
      [id, isActive],
    );
    if (!row) throw new NotFoundException();
    return mapToken(row);
  }

  // ---------------------------------------------------------- notifications
  async sendNotification(dto: SendNotificationDto) {
    if (dto.allApproved) {
      const res = await this.db.query(
        `insert into notifications (creator_id, title, message, type)
         select id, $1, $2, $3 from creator_profiles where status = 'approved' returning id`,
        [dto.title, dto.message, dto.type],
      );
      return { sent: res.length };
    }
    if (!dto.creatorIds?.length) throw new BadRequestException('Choose at least one creator.');
    const res = await this.db.query(
      `insert into notifications (creator_id, title, message, type)
       select id, $2, $3, $4 from creator_profiles where id = any($1::uuid[]) returning id`,
      [dto.creatorIds, dto.title, dto.message, dto.type],
    );
    return { sent: res.length };
  }

  // ------------------------------------------------------------------- seed
  async seedAdmin(userId: string, name: string, role: string) {
    const user = await this.db.one('select email from users where id = $1', [userId]);
    if (!user) throw new NotFoundException('Signed-in user not found.');
    await this.db.query(
      `insert into admin_users (id, name, email, role) values ($1, $2, $3, $4)
       on conflict (id) do update set name = excluded.name, role = excluded.role`,
      [userId, name, user.email, role],
    );
  }
}

function mapToken(r: any) {
  return {
    id: r.id,
    token: r.token,
    label: r.label,
    isEventToken: r.is_event_token,
    usedCount: r.used_count,
    maxUses: r.max_uses,
    expiresAt: r.expires_at,
    isActive: r.is_active,
    state: r.state,
    createdAt: r.created_at,
  };
}
