import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { SeedController } from './seed.controller';
import { AdminService } from './admin.service';

@Module({
  // SeedController first so /admin/seed isn't shadowed by AdminGuard routes.
  controllers: [SeedController, AdminController],
  providers: [AdminService],
})
export class AdminModule {}
