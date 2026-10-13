import { Module } from '@nestjs/common';
import { CoCreateAdminController } from './co-create-admin.controller';
import { CoCreateAdminService } from './co-create-admin.service';
import { CoCreateFilesService } from './co-create-files.service';
import { CoCreateController } from './co-create.controller';
import { CoCreateService } from './co-create.service';

@Module({
  controllers: [CoCreateController, CoCreateAdminController],
  providers: [CoCreateService, CoCreateAdminService, CoCreateFilesService],
})
export class CoCreateModule {}
