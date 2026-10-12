import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { SESSION_COOKIE } from '../auth/auth.types';
import { EnrollmentService } from '../enrollment/enrollment.service';

/** Allows a signed-in session, or a valid enrollment token (?token=) for users still enrolling. */
@Injectable()
export class SessionOrTokenGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly enrollment: EnrollmentService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const cookie = req.cookies?.[SESSION_COOKIE];
    const user = cookie ? this.auth.verify(cookie) : null;
    if (user) {
      req.sessionUser = user;
      return true;
    }
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (token && (await this.enrollment.tokenState(token)).state === 'valid') return true;
    throw new UnauthorizedException('Please sign in with Google.');
  }
}
