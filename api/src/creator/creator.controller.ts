import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { ProfileDto } from '../common/profile.dto';
import { CreatorService } from './creator.service';

/** Everything here is scoped to the signed-in creator's own rows. */
@Controller('me')
@UseGuards(SessionGuard)
export class CreatorController {
  constructor(private readonly creator: CreatorService) {}

  @Get('summary')
  summary(@Req() req: Request) {
    return this.creator.summary(req.sessionUser!.id);
  }

  @Get('profile')
  profile(@Req() req: Request) {
    return this.creator.getProfile(req.sessionUser!.id);
  }

  @Put('profile')
  updateProfile(@Req() req: Request, @Body() dto: ProfileDto) {
    return this.creator.updateProfile(req.sessionUser!.id, dto);
  }

  @Get('campaigns')
  campaigns(@Req() req: Request) {
    return this.creator.campaigns(req.sessionUser!.id);
  }

  @Post('campaigns/:id/interest')
  interest(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.creator.expressInterest(req.sessionUser!.id, id);
  }

  @Get('notifications')
  notifications(@Req() req: Request) {
    return this.creator.notifications(req.sessionUser!.id);
  }

  @Post('notifications/read-all')
  readAll(@Req() req: Request) {
    return this.creator.markAllRead(req.sessionUser!.id);
  }

  @Post('notifications/:id/read')
  read(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.creator.markRead(req.sessionUser!.id, id);
  }
}
