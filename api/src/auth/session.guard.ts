import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './auth.types';

/** Requires a valid signed session cookie (Google sign-in). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[SESSION_COOKIE];
    const user = token ? this.auth.verify(token) : null;
    if (!user) throw new UnauthorizedException('Please sign in with Google.');
    req.sessionUser = user;
    return true;
  }
}
