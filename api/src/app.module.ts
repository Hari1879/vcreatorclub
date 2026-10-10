import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { CreatorModule } from './creator/creator.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default limit for all routes; public enrollment routes tighten
    // this to 20/min per IP (handover Part I5) with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DbModule,
    AuthModule,
    EnrollmentModule,
    CreatorModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
