import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IsInt, IsObject, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import { EnrollmentService } from './enrollment.service';
import { SessionGuard } from '../auth/session.guard';
import { SubmitEnrollmentDto } from '../common/profile.dto';

class DraftDto {
  @IsUUID() draftId!: string;
  @IsString() @Matches(/^vcc-[a-f0-9]{32}$/) token!: string;
  @IsInt() @Min(1) @Max(3) step!: number;
  @IsObject() data!: Record<string, unknown>;
}

const PUBLIC_LIMIT = { default: { ttl: 60_000, limit: 20 } }; // Part I5

@Controller('enrollment')
export class EnrollmentController {
  constructor(private readonly enrollment: EnrollmentService) {}

  @Get('tokens/validate')
  @Throttle(PUBLIC_LIMIT)
  validate(@Query('token') token: string) {
    return this.enrollment.tokenState(token);
  }

  @Post('draft')
  @Throttle(PUBLIC_LIMIT)
  saveDraft(@Body() dto: DraftDto) {
    return this.enrollment.saveDraft(dto.draftId, dto.token, dto.step, dto.data);
  }

  @Get('draft/:draftId')
  @Throttle(PUBLIC_LIMIT)
  getDraft(@Param('draftId', ParseUUIDPipe) draftId: string, @Query('token') token: string) {
    return this.enrollment.getDraft(draftId, token);
  }

  @Post('submit')
  @Throttle(PUBLIC_LIMIT)
  @UseGuards(SessionGuard)
  submit(@Req() req: Request, @Body() dto: SubmitEnrollmentDto) {
    return this.enrollment.submit(req.sessionUser!.id, dto);
  }
}
