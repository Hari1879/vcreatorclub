import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { SessionOrTokenGuard } from './session-or-token.guard';
import { CreatorController } from './creator.controller';
import { CreatorService } from './creator.service';
import { FollowerCountController } from './follower-count.controller';
import { FollowerCountService } from './follower-count.service';

@Module({
  imports: [EnrollmentModule],
  controllers: [CreatorController, FollowerCountController],
  providers: [CreatorService, FollowerCountService, SessionOrTokenGuard],
})
export class CreatorModule {}
