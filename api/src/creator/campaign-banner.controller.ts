import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { DbService } from '../db/db.service';

/** Serves campaign banners to any signed-in user; drafts are visible to admins only. */
@Controller('campaigns')
@UseGuards(SessionGuard)
export class CampaignBannerController {
  constructor(private readonly db: DbService) {}

  @Get(':id/banner')
  async banner(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const row = await this.db.one(
      `select b.mime, b.data from campaign_banners b join campaigns c on c.id = b.campaign_id
        where b.campaign_id = $1
          and (c.status <> 'draft' or exists (select 1 from admin_users a where a.id = $2))`,
      [id, req.sessionUser!.id],
    );
    if (!row) throw new NotFoundException();
    res.set({
      'Content-Type': row.mime,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(row.data);
  }
}
