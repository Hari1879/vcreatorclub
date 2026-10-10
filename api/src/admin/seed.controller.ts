import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { SessionGuard } from '../auth/session.guard';
import { AdminService } from './admin.service';

/**
 * One-time admin bootstrap (handover Part L).
 *   1. Sign in with Google at /admin
 *   2. Visit /api/admin/seed?secret=<ADMIN_SEED_SECRET>&name=SK&role=super_admin
 *   3. Set ENABLE_ADMIN_SEED=false and restart the API.
 */
@Controller('admin/seed')
export class SeedController {
  constructor(
    private readonly config: ConfigService,
    private readonly admin: AdminService,
  ) {}

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(SessionGuard)
  async seed(
    @Req() req: Request,
    @Query('secret') secret: string,
    @Query('name') name: string,
    @Query('role') role = 'super_admin',
  ) {
    if (this.config.get('ENABLE_ADMIN_SEED') !== 'true') throw new NotFoundException();
    const expected = this.config.get<string>('ADMIN_SEED_SECRET');
    if (!expected || expected.length < 16) {
      throw new ForbiddenException('Seeding is not configured on the server.');
    }
    const h = (s: string) => createHash('sha256').update(s ?? '').digest();
    if (!timingSafeEqual(h(secret), h(expected))) {
      throw new ForbiddenException('Invalid seed secret.');
    }
    const cleanName = (name ?? '').trim();
    if (cleanName.length < 2 || cleanName.length > 60) {
      throw new BadRequestException('Provide a name (2–60 characters).');
    }
    if (!['super_admin', 'admin', 'viewer'].includes(role)) {
      throw new BadRequestException('Role must be super_admin, admin or viewer.');
    }
    await this.admin.seedAdmin(req.sessionUser!.id, cleanName, role);
    return { success: true, message: `Admin ${cleanName} seeded as ${role}` };
  }
}
