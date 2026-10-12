import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard, SuperAdminOnly } from '../auth/admin.guard';
import { ListUsersQuery, SetRoleDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(AdminGuard)
@SuperAdminOnly()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Req() req: Request, @Query() q: ListUsersQuery) {
    return this.users.list(q, req.admin!.id);
  }

  @Put(':userId/role')
  setRole(
    @Req() req: Request,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.users.setRole(req.admin!.id, userId, dto);
  }
}
