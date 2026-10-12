import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DbService } from '../db/db.service';
import { SessionGuard } from './session.guard';
import { AdminContext } from './auth.types';

/** Mark a route as a write action — 'viewer' admins are read-only. */
export const ADMIN_WRITE = 'vcc_admin_write';
export const AdminWrite = () => SetMetadata(ADMIN_WRITE, true);

/** Mark a route as restricted to super admins. */
export const SUPER_ADMIN_ONLY = 'vcc_super_admin_only';
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY, true);

/** Requires sign-in AND a row in admin_users. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly session: SessionGuard,
    private readonly db: DbService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    this.session.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest<Request>();
    const admin = await this.db.one<AdminContext>(
      'select id, name, email, role from admin_users where id = $1',
      [req.sessionUser!.id],
    );
    if (!admin) {
      throw new ForbiddenException(
        'Access denied. This area is restricted to authorised VCC team members.',
      );
    }
    const superOnly = this.reflector.getAllAndOverride<boolean>(
      SUPER_ADMIN_ONLY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (superOnly && admin.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can manage users.');
    }
    const isWrite = this.reflector.getAllAndOverride<boolean>(ADMIN_WRITE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isWrite && admin.role === 'viewer') {
      throw new ForbiddenException('Your admin role is view-only.');
    }
    req.admin = admin;
    return true;
  }
}
