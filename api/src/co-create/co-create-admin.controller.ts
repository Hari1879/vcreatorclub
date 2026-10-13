import {
  Body,
  Controller,
  Get,
  Header,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard, AdminWrite } from '../auth/admin.guard';
import { CoCreateAdminService } from './co-create-admin.service';
import { DecisionDto, ListCoCreateQuery, MarkReadDto } from './co-create.dto';

/**
 * Roles: every admin role can read. Decisions, account reveal and read-marking
 * need a write role (`admin` or `super_admin`; `viewer` is read-only).
 */
@Controller('admin/co-create')
@UseGuards(AdminGuard)
export class CoCreateAdminController {
  constructor(private readonly svc: CoCreateAdminService) {}

  @Get('requests')
  list(@Query() q: ListCoCreateQuery) {
    return this.svc.list(q);
  }

  @Get('summary')
  summary() {
    return this.svc.summary();
  }

  @Get('requests/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.detail(id);
  }

  @Post('requests/:id/reveal-account')
  @AdminWrite()
  @Header('Cache-Control', 'no-store')
  reveal(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
  ) {
    return this.svc.revealAccount(id, req.admin!, ip);
  }

  @Get('requests/:id/files/:fileId')
  file(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Ip() ip: string,
  ) {
    return this.svc.fileUrl(id, fileId, req.admin!, ip);
  }

  @Post('requests/:id/decision')
  @AdminWrite()
  decide(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
    @Ip() ip: string,
  ) {
    return this.svc.decide(id, req.admin!, dto.decision, dto.note, ip);
  }

  @Post('notifications/read')
  @AdminWrite()
  read(@Req() req: Request, @Body() dto: MarkReadDto) {
    return this.svc.markRead(req.admin!.id, dto.ids);
  }
}
