import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { DbService } from '../db/db.service';
import { SESSION_COOKIE, SessionUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async upsertGoogleUser(input: {
    googleId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  }): Promise<SessionUser> {
    const row = await this.db.one<SessionUser>(
      `insert into users (google_id, email, name, avatar_url, last_login_at)
       values ($1, $2, $3, $4, now())
       on conflict (email) do update
         set google_id = coalesce(users.google_id, excluded.google_id),
             name = coalesce(excluded.name, users.name),
             avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
             last_login_at = now()
       returning id, email, name`,
      [input.googleId, input.email, input.name, input.avatarUrl],
    );
    return row!;
  }

  setSessionCookie(res: Response, user: SessionUser) {
    const token = this.jwt.sign({ sub: user.id, email: user.email, name: user.name });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  clearSessionCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  verify(token: string): SessionUser | null {
    try {
      const p = this.jwt.verify<{ sub: string; email: string; name: string | null }>(token);
      return { id: p.sub, email: p.email, name: p.name };
    } catch {
      return null;
    }
  }

  async describe(userId: string) {
    return this.db.one(
      `select u.id, u.email, u.name, u.avatar_url,
              a.role as admin_role, a.name as admin_name,
              c.status as profile_status, c.full_name as profile_name
         from users u
         left join admin_users a on a.id = u.id
         left join creator_profiles c on c.id = u.id
        where u.id = $1`,
      [userId],
    );
  }
}

/** Only allow same-site relative redirects after OAuth (no open redirect). */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value.length > 500) return '/';
  return value;
}
