import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SessionGuard } from '../auth/session.guard';
import { FollowerCountQueryDto } from './follower-count.dto';
import { FollowerCountService } from './follower-count.service';

@Controller('creators')
@UseGuards(SessionGuard)
export class FollowerCountController {
  constructor(private readonly followers: FollowerCountService) {}

  @Get('follower-count')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  followerCount(@Query() q: FollowerCountQueryDto) {
    return this.followers.getCount(q.platform, q.url);
  }
}
