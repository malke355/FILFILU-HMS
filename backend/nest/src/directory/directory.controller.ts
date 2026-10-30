import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { DirectoryService } from './directory.service';

@Controller()
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('health')
  health() {
    return this.directory.health();
  }

  @Get('departments')
  departments() {
    return this.directory.departments();
  }

  @Get('doctors')
  doctors() {
    return this.directory.doctors();
  }

  @Get('specialties')
  specialties() {
    return this.directory.specialties();
  }

  @Get('doctor-schedules')
  @UseGuards(JwtAuthGuard)
  doctorSchedules(
    @Req() request: { user: JwtPayload },
    @Query('specialty') specialty?: string | string[],
  ) {
    const filter = typeof specialty === 'string' ? specialty : undefined;
    return this.directory.doctorSchedules(request.user.role, filter);
  }
}
