import { Module } from '@nestjs/common';
import { CreatorController } from './creator.controller';
import { CreatorService } from './creator.service';
import { FollowerCountController } from './follower-count.controller';
import { FollowerCountService } from './follower-count.service';

@Module({
  controllers: [CreatorController, FollowerCountController],
  providers: [CreatorService, FollowerCountService],
})
export class CreatorModule {}
