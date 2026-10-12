import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ListUsersQuery, SetRoleDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async list(q: ListUsersQuery, currentAdminId: string) {
    const params: unknown[] = [];
    let where = '';
    if (q.search) {
      params.push(`%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
      where = `where (u.name ilike $1 or u.email ilike $1)`;
    }
    const total = await this.db.one<{ n: number }>(
      `select count(*)::int as n from users u ${where}`,
      params,
    );
    params.push(q.pageSize, (q.page - 1) * q.pageSize);
    const rows = await this.db.query(
      `select u.id, u.name, u.email, u.avatar_url, u.created_at, u.last_login_at,
              a.role, (p.id is not null) as is_creator
         from users u
         left join admin_users a on a.id = u.id
         left join creator_profiles p on p.id = u.id
         ${where}
        order by u.last_login_at desc nulls last, u.created_at desc
        limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar_url,
        createdAt: r.created_at,
        lastLoginAt: r.last_login_at,
        role: r.role ?? null,
        isCreator: r.is_creator,
        isYou: r.id === currentAdminId,
      })),
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async setRole(currentAdminId: string, userId: string, dto: SetRoleDto) {
    if (userId === currentAdminId)
      throw new BadRequestException("You can't change your own role.");
    return this.db.tx(async (c) => {
      const user = await c.query('select id from users where id = $1', [
        userId,
      ]);
      if (!user.rowCount) throw new NotFoundException('User not found.');

      // Lock every admin row so concurrent changes can't both remove the last super admin.
      const admins = await c.query(
        'select id, role from admin_users for update',
      );
      const current: string | null =
        admins.rows.find((r) => r.id === userId)?.role ?? null;
      const superCount = admins.rows.filter(
        (r) => r.role === 'super_admin',
      ).length;
      if (
        current === 'super_admin' &&
        dto.role !== 'super_admin' &&
        superCount <= 1
      ) {
        throw new BadRequestException('At least one super admin is required.');
      }

      if (dto.role === 'none') {
        await c.query('delete from admin_users where id = $1', [userId]);
        return { id: userId, role: null };
      }
      await c.query(
        `insert into admin_users (id, name, email, role)
         select id, coalesce(name, email), email, $2 from users where id = $1
         on conflict (id) do update set role = excluded.role`,
        [userId, dto.role],
      );
      return { id: userId, role: dto.role };
    });
  }
}
