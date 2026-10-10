import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ProfileDto, corePlatformError, profileColumns, sqlSet } from '../common/profile.dto';
import { mapCampaign, mapNotification, mapProfile } from '../common/profile.mapper';

@Injectable()
export class CreatorService {
  constructor(private readonly db: DbService) {}

  private async profileRow(userId: string) {
    const row = await this.db.one('select * from creator_profiles where id = $1', [userId]);
    if (!row) throw new NotFoundException('No VCC enrollment found for this account.');
    return row;
  }

  /** Campaigns & notifications are only for approved creators. */
  private async approvedRow(userId: string) {
    const row = await this.profileRow(userId);
    if (row.status !== 'approved') throw new ForbiddenException('Your application is under review.');
    return row;
  }

  async getProfile(userId: string) {
    return mapProfile(await this.profileRow(userId));
  }

  async updateProfile(userId: string, dto: ProfileDto) {
    await this.profileRow(userId);
    const err = corePlatformError(dto);
    if (err) throw new BadRequestException(err);
    const s = sqlSet(profileColumns(dto), 2);
    const row = await this.db.one(
      `update creator_profiles set ${s.setClause} where id = $1 returning *`,
      [userId, ...s.values],
    );
    return mapProfile(row);
  }

  async summary(userId: string) {
    const profile = await this.profileRow(userId);
    if (profile.status !== 'approved') return { profile: mapProfile(profile) };
    const [notifications, unread, campaigns] = await Promise.all([
      this.db.query(
        'select * from notifications where creator_id = $1 order by created_at desc limit 3',
        [userId],
      ),
      this.db.one<{ n: string }>(
        'select count(*) as n from notifications where creator_id = $1 and not read',
        [userId],
      ),
      this.openCampaignRows(userId, profile.tier, 3),
    ]);
    return {
      profile: mapProfile(profile),
      notifications: notifications.map(mapNotification),
      unreadCount: Number(unread?.n ?? 0),
      campaigns: campaigns.map(mapCampaign),
    };
  }

  private openCampaignRows(userId: string, tier: string, limit = 100) {
    return this.db.query(
      `select c.*, a.status as my_assignment_status
         from campaigns c
         left join campaign_assignments a on a.campaign_id = c.id and a.creator_id = $1
        where c.status = 'open' and $2 = any(c.eligible_tiers)
        order by c.deadline asc nulls last, c.created_at desc
        limit $3`,
      [userId, tier, limit],
    );
  }

  async campaigns(userId: string) {
    const p = await this.approvedRow(userId);
    return (await this.openCampaignRows(userId, p.tier)).map(mapCampaign);
  }

  async expressInterest(userId: string, campaignId: string) {
    const p = await this.approvedRow(userId);
    return this.db.tx(async (c) => {
      const camp = await c.query(
        `select id, max_creators, deadline from campaigns
          where id = $1 and status = 'open' and $2 = any(eligible_tiers)
          for update`,
        [campaignId, p.tier],
      );
      if (!camp.rowCount) throw new NotFoundException('This campaign is not available.');
      const { max_creators, deadline } = camp.rows[0];
      if (deadline && new Date(deadline) < new Date()) {
        throw new BadRequestException('This campaign has passed its deadline.');
      }
      if (max_creators) {
        const n = await c.query(
          `select count(*)::int as n from campaign_assignments
            where campaign_id = $1 and status not in ('declined', 'cancelled')`,
          [campaignId],
        );
        if (n.rows[0].n >= max_creators) throw new ConflictException('This campaign is full.');
      }
      const ins = await c.query(
        `insert into campaign_assignments (campaign_id, creator_id, status)
         values ($1, $2, 'invited')
         on conflict (campaign_id, creator_id) do nothing
         returning status`,
        [campaignId, userId],
      );
      return { ok: true, status: ins.rows[0]?.status ?? 'invited' };
    });
  }

  async notifications(userId: string) {
    await this.approvedRow(userId);
    const rows = await this.db.query(
      'select * from notifications where creator_id = $1 order by created_at desc limit 200',
      [userId],
    );
    return rows.map(mapNotification);
  }

  async markRead(userId: string, id: string) {
    await this.db.query('update notifications set read = true where id = $1 and creator_id = $2', [
      id,
      userId,
    ]);
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.db.query('update notifications set read = true where creator_id = $1 and not read', [
      userId,
    ]);
    return { ok: true };
  }
}
