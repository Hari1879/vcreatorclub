import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminGuard, AdminWrite } from '../auth/admin.guard';
import { AdminService } from './admin.service';
import { CsvExportService } from './csv-export.service';
import {
  ApproveDto,
  AssignmentUpdateDto,
  CampaignDto,
  CampaignStatusDto,
  CreateTokenDto,
  ListCreatorsQuery,
  RejectDto,
  SendNotificationDto,
  UpdateCreatorDto,
  UpdateTokenDto,
} from './admin.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly csv: CsvExportService,
  ) {}

  @Get('me')
  me(@Req() req: Request) {
    return req.admin;
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  // ---- creators
  @Get('creators')
  creators(@Query() q: ListCreatorsQuery) {
    return this.admin.listCreators(q);
  }

  // Must stay above creators/:id, otherwise "export" is captured as an id.
  @Get('creators/export')
  async exportCreators(@Query() q: ListCreatorsQuery, @Res() res: Response) {
    const body = await this.csv.creatorsCsv(q);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    res
      .status(200)
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vcc-creators-${date}.csv"`,
        'Cache-Control': 'no-store',
      })
      .send(body);
  }

  @Get('creators/:id')
  creator(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getCreator(id);
  }

  @Post('creators/approve')
  @AdminWrite()
  approve(@Req() req: Request, @Body() dto: ApproveDto) {
    return this.admin.approve(req.admin!.id, dto.ids);
  }

  @Post('creators/:id/reject')
  @AdminWrite()
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.admin.reject(id, dto.note);
  }

  @Patch('creators/:id')
  @AdminWrite()
  updateCreator(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCreatorDto) {
    return this.admin.updateCreator(id, dto);
  }

  // ---- campaigns
  @Get('campaigns')
  campaigns() {
    return this.admin.listCampaigns();
  }

  @Get('campaigns/:id')
  campaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.campaignDetail(id);
  }

  @Post('campaigns')
  @AdminWrite()
  createCampaign(@Req() req: Request, @Body() dto: CampaignDto) {
    return this.admin.createCampaign(req.admin!.id, dto);
  }

  @Put('campaigns/:id')
  @AdminWrite()
  updateCampaign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CampaignDto) {
    return this.admin.updateCampaign(id, dto);
  }

  @Post('campaigns/:id/status')
  @AdminWrite()
  campaignStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CampaignStatusDto) {
    return this.admin.setCampaignStatus(id, dto.status);
  }

  @Delete('campaigns/:id')
  @AdminWrite()
  deleteCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteCampaign(id);
  }

  @Patch('assignments/:id')
  @AdminWrite()
  updateAssignment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignmentUpdateDto) {
    return this.admin.updateAssignment(id, dto);
  }

  // ---- tokens
  @Get('tokens')
  tokens() {
    return this.admin.listTokens();
  }

  @Post('tokens')
  @AdminWrite()
  createToken(@Req() req: Request, @Body() dto: CreateTokenDto) {
    return this.admin.createToken(req.admin!.id, dto);
  }

  @Patch('tokens/:id')
  @AdminWrite()
  updateToken(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTokenDto) {
    return this.admin.setTokenActive(id, dto.isActive);
  }

  // ---- notifications
  @Post('notifications')
  @AdminWrite()
  notify(@Body() dto: SendNotificationDto) {
    return this.admin.sendNotification(dto);
  }
}
