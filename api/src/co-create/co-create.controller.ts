import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { CoCreateFilesService } from './co-create-files.service';
import { CoCreateService } from './co-create.service';
import { TermsQuery } from './co-create.dto';

/** Creator-facing routes. The creator id always comes from the session. */
@Controller('co-create')
export class CoCreateController {
  constructor(
    private readonly svc: CoCreateService,
    private readonly files: CoCreateFilesService,
  ) {}

  @Get('terms')
  @UseGuards(SessionGuard)
  terms(@Query() q: TermsQuery) {
    return this.svc.terms(q.supportType);
  }

  @Post('uploads')
  @UseGuards(SessionGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body('kind') kind: unknown,
  ) {
    return this.files.upload(req.sessionUser!.id, kind, file);
  }

  @Post('requests')
  @UseGuards(SessionGuard)
  submit(
    @Req() req: Request,
    @Headers('idempotency-key') key: string | undefined,
    @Headers('user-agent') ua: string | undefined,
    @Ip() ip: string,
    @Body() body: unknown,
  ) {
    return this.svc.submit(req.sessionUser!.id, key, body, ip, ua);
  }

  // Declared before any :id route would be; only literal routes exist here.
  @Get('requests/mine')
  @UseGuards(SessionGuard)
  mine(@Req() req: Request) {
    return this.svc.mine(req.sessionUser!.id);
  }

  /** Authorised by a 60-second signed token issued to an admin; no session needed. */
  @Get('files/download')
  async download(@Query('token') token: string, @Res() res: Response) {
    const f = await this.files.openSigned(token);
    const safe = encodeURIComponent(f.original_name);
    res
      .status(200)
      .set({
        'Content-Type': f.mime,
        'Content-Disposition': `attachment; filename*=UTF-8''${safe}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      })
      .send(f.data);
  }
}
