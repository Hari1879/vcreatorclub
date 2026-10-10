import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      // Placeholders let the API boot locally before Google creds exist;
      // sign-in simply fails until real values are set.
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'not-configured',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'not-configured',
      callbackURL: `${config.get<string>('APP_URL', 'http://localhost:4200')}/api/auth/google/callback`,
      scope: ['openid', 'email', 'profile'],
    });
  }

  async validate(_access: string, _refresh: string, profile: Profile) {
    const email = profile.emails?.find((e) => e.verified)?.value ?? profile.emails?.[0]?.value;
    if (!email) throw new Error('Google account has no email');
    return this.auth.upsertGoogleUser({
      googleId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName ?? null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    });
  }
}
