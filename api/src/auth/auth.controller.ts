import {
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService, safeReturnTo } from './auth.service';
import { SessionGuard } from './session.guard';
import { SessionUser } from './auth.types';

/** Carries the post-login destination through Google via OAuth `state`. */
@Injectable()
class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.path.endsWith('/callback')) return {};
    return {
      state: Buffer.from(safeReturnTo(req.query.returnTo)).toString('base64url'),
      prompt: 'select_account',
    };
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Start Google sign-in. Usage: /api/auth/google?returnTo=/dashboard */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  google() {
    // Passport redirects to Google.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as SessionUser;
    this.auth.setSessionCookie(res, user);
    let returnTo = '/';
    try {
      returnTo = safeReturnTo(Buffer.from(String(req.query.state ?? ''), 'base64url').toString());
    } catch {
      /* fall back to / */
    }
    res.redirect(returnTo);
  }

  /**
   * Local development only: sign in without Google.
   * Enabled only when ENABLE_DEV_LOGIN=true AND NODE_ENV !== production.
   */
  @Get('dev-login')
  async devLogin(
    @Query('email') email: string,
    @Query('returnTo') returnTo: string,
    @Res() res: Response,
  ) {
    const enabled =
      this.config.get('ENABLE_DEV_LOGIN') === 'true' && this.config.get('NODE_ENV') !== 'production';
    if (!enabled || !email) throw new NotFoundException();
    const user = await this.auth.upsertGoogleUser({
      googleId: `dev-${email}`,
      email: email.toLowerCase(),
      name: email.split('@')[0],
      avatarUrl: null,
    });
    this.auth.setSessionCookie(res, user);
    res.redirect(safeReturnTo(returnTo));
  }

  @Get('me')
  @SkipThrottle()
  async me(@Req() req: Request) {
    const token = req.cookies?.vcc_session;
    const user = token ? this.auth.verify(token) : null;
    if (!user) return { signedIn: false };
    const row = await this.auth.describe(user.id);
    if (!row) return { signedIn: false };
    return {
      signedIn: true,
      user: { id: row.id, email: row.email, name: row.name, avatarUrl: row.avatar_url },
      admin: row.admin_role ? { role: row.admin_role, name: row.admin_name } : null,
      profile: row.profile_status ? { status: row.profile_status, fullName: row.profile_name } : null,
    };
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearSessionCookie(res);
    return { ok: true };
  }
}
